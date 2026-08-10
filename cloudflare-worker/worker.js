const DEFAULT_UPSTREAM_URL =
  "https://www.imrafaelaliev.ru/telegram-bot/index.php";
const MAX_WEBHOOK_BODY_BYTES = 1_000_000;
const TELEGRAM_API_PREFIX = "/telegram-api/";
const TELEGRAM_API_METHODS = new Set([
  "answerCallbackQuery",
  "getChatMember",
  "getMe",
  "sendDocument",
  "sendMessage",
  "sendPhoto",
  "sendVideo",
]);
const textEncoder = new TextEncoder();

const jsonResponse = (payload, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });

const hexToBytes = (value) => {
  if (!/^[a-f0-9]{64}$/i.test(value)) {
    return null;
  }

  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }
  return bytes;
};

const verifyTelegramProxySignature = async (signature, secret, method) => {
  const signatureBytes = hexToBytes(signature);
  if (!signatureBytes || !secret) {
    return false;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes,
    textEncoder.encode(method),
  );
};

const handleTelegramApiProxy = async (request, env, url) => {
  if (request.method !== "POST") {
    return jsonResponse(
      { status: "error", message: "Method not allowed" },
      405,
      { allow: "POST" },
    );
  }

  const method = url.pathname.slice(TELEGRAM_API_PREFIX.length);
  if (!TELEGRAM_API_METHODS.has(method)) {
    return jsonResponse(
      { status: "error", message: "Telegram method not allowed" },
      404,
    );
  }

  if (!env.BOT_TOKEN || !env.TELEGRAM_PROXY_SECRET) {
    return jsonResponse(
      { status: "error", message: "Telegram proxy is not configured" },
      503,
    );
  }

  const signature = request.headers.get("x-telegram-proxy-signature") || "";
  if (
    !(await verifyTelegramProxySignature(
      signature,
      env.TELEGRAM_PROXY_SECRET,
      method,
    ))
  ) {
    return jsonResponse(
      { status: "error", message: "Telegram proxy authorization failed" },
      403,
    );
  }

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }

  try {
    const telegram = await fetch(
      `https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`,
      {
        method: "POST",
        headers,
        body: request.body,
        redirect: "manual",
      },
    );

    return new Response(telegram.body, {
      status: telegram.status,
      statusText: telegram.statusText,
      headers: {
        "content-type":
          telegram.headers.get("content-type") || "application/json",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    console.error({
      message: "Telegram API proxy request failed",
      method,
      error: error instanceof Error ? error.message : String(error),
    });
    return jsonResponse(
      { status: "error", message: "Telegram API unavailable" },
      502,
    );
  }
};

const handleTelegramWebhook = async (request, env, ctx) => {
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
  if (contentLength > MAX_WEBHOOK_BODY_BYTES) {
    return jsonResponse(
      { status: "error", message: "Request body is too large" },
      413,
    );
  }

  const body = await request.arrayBuffer();
  if (body.byteLength > MAX_WEBHOOK_BODY_BYTES) {
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
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith(TELEGRAM_API_PREFIX)) {
      return handleTelegramApiProxy(request, env, url);
    }
    if (url.pathname !== "/") {
      return jsonResponse({ status: "error", message: "Not found" }, 404);
    }
    return handleTelegramWebhook(request, env, ctx);
  },
};
