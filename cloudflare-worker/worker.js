const DEFAULT_UPSTREAM_URL =
  "https://www.imrafaelaliev.ru/telegram-bot/index.php";
const MAX_BODY_BYTES = 1_000_000;

const jsonResponse = (payload, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });

export default {
  async fetch(request, env, ctx) {
    if (request.method === "GET" || request.method === "HEAD") {
      const body =
        request.method === "HEAD"
          ? null
          : JSON.stringify({
              status: "ok",
              service: "telegram-cloudflare-relay",
            });

      return new Response(body, {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }

    if (request.method !== "POST") {
      return jsonResponse(
        { status: "error", message: "Method not allowed" },
        405,
        { allow: "GET, HEAD, POST" },
      );
    }

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return jsonResponse(
        { status: "error", message: "JSON body required" },
        415,
      );
    }

    const telegramSecret = request.headers.get(
      "x-telegram-bot-api-secret-token",
    );
    if (!telegramSecret) {
      return jsonResponse(
        { status: "error", message: "Missing Telegram secret" },
        403,
      );
    }

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_BODY_BYTES) {
      return jsonResponse(
        { status: "error", message: "Request body is too large" },
        413,
      );
    }

    const body = await request.arrayBuffer();
    if (body.byteLength > MAX_BODY_BYTES) {
      return jsonResponse(
        { status: "error", message: "Request body is too large" },
        413,
      );
    }

    let updateId;
    try {
      const update = JSON.parse(new TextDecoder().decode(body));
      updateId = Number(update.update_id);
      if (!Number.isSafeInteger(updateId) || updateId <= 0) {
        throw new Error("Invalid update_id");
      }
    } catch {
      return jsonResponse(
        { status: "error", message: "Invalid Telegram update" },
        400,
      );
    }

    const upstreamHeaders = new Headers({
      "content-type": "application/json",
      "x-telegram-bot-api-secret-token": telegramSecret,
    });

    try {
      const upstream = await fetch(
        env.UPSTREAM_URL || DEFAULT_UPSTREAM_URL,
        {
          method: "POST",
          headers: upstreamHeaders,
          body,
          redirect: "manual",
        },
      );

      if (upstream.ok) {
        const processorUrl = new URL(
          "process.php",
          env.UPSTREAM_URL || DEFAULT_UPSTREAM_URL,
        );
        processorUrl.searchParams.set("job", String(updateId));
        ctx.waitUntil(
          fetch(processorUrl, {
            method: "POST",
            headers: {
              "x-telegram-bot-worker-secret": telegramSecret,
            },
            body: "",
            redirect: "manual",
          })
            .then((response) => {
              if (!response.ok) {
                console.error({
                  message: "Telegram queue processor rejected the request",
                  status: response.status,
                  updateId,
                });
              }
            })
            .catch((error) => {
              console.error({
                message: "Telegram queue processor request failed",
                error: error instanceof Error ? error.message : String(error),
                updateId,
              });
            }),
        );
      }

      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: {
          "content-type":
            upstream.headers.get("content-type") || "application/json",
          "cache-control": "no-store",
        },
      });
    } catch (error) {
      console.error({
        message: "Telegram webhook upstream request failed",
        error: error instanceof Error ? error.message : String(error),
      });

      return jsonResponse(
        { status: "error", message: "Upstream unavailable" },
        502,
      );
    }
  },
};
