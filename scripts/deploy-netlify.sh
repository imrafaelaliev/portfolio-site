#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.netlify-deploy.env"

if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
fi

NETLIFY_AUTH_TOKEN="${NETLIFY_AUTH_TOKEN:-}"
NETLIFY_SITE_ID="${NETLIFY_SITE_ID:-}"

if [[ -z "${NETLIFY_AUTH_TOKEN}" || -z "${NETLIFY_SITE_ID}" ]]; then
  echo "Error: NETLIFY_AUTH_TOKEN or NETLIFY_SITE_ID is missing."
  echo "Set vars in environment or in .netlify-deploy.env"
  exit 1
fi

if ! command -v zip >/dev/null 2>&1; then
  echo "Error: zip command is not installed."
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "Error: curl command is not installed."
  exit 1
fi

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
STAGE_DIR="${ROOT_DIR}/deploy/netlify-live-${TIMESTAMP}"
ZIP_PATH="${ROOT_DIR}/deploy/netlify-live-${TIMESTAMP}.zip"

echo "[1/3] Preparing archive..."
mkdir -p "${ROOT_DIR}/deploy"
mkdir -p "${STAGE_DIR}"

cp -R \
  "${ROOT_DIR}/index.html" \
  "${ROOT_DIR}/assets" \
  "${ROOT_DIR}/css" \
  "${ROOT_DIR}/js" \
  "${ROOT_DIR}/marshall" \
  "${ROOT_DIR}/hios" \
  "${ROOT_DIR}/sladonezh" \
  "${ROOT_DIR}/lori" \
  "${STAGE_DIR}/"

for optional_file in "_headers" "_redirects"; do
  if [[ -f "${ROOT_DIR}/${optional_file}" ]]; then
    cp "${ROOT_DIR}/${optional_file}" "${STAGE_DIR}/"
  fi
done

find "${STAGE_DIR}" -name ".DS_Store" -delete

(
  cd "${STAGE_DIR}"
  zip -qr "${ZIP_PATH}" .
)

ARCHIVE_SIZE="$(du -h "${ZIP_PATH}" | awk '{print $1}')"
echo "Archive ready: ${ZIP_PATH} (${ARCHIVE_SIZE})"
echo "[2/3] Uploading to Netlify..."

RESPONSE_FILE="$(mktemp)"
set +e
HTTP_CODE="$(
  curl -sS -o "${RESPONSE_FILE}" -w "%{http_code}" \
    --http1.1 \
    --retry 4 \
    --retry-delay 2 \
    --retry-all-errors \
    --connect-timeout 20 \
    --max-time 240 \
    -X POST "https://api.netlify.com/api/v1/sites/${NETLIFY_SITE_ID}/deploys" \
    -H "Authorization: Bearer ${NETLIFY_AUTH_TOKEN}" \
    -H "Content-Type: application/zip" \
    --data-binary @"${ZIP_PATH}"
)"
CURL_EXIT="$?"
set -e

if [[ "${CURL_EXIT}" -ne 0 ]]; then
  echo "Deploy upload failed before API response. curl exit code: ${CURL_EXIT}"
  rm -f "${RESPONSE_FILE}"
  exit "${CURL_EXIT}"
fi

if [[ "${HTTP_CODE}" -lt 200 || "${HTTP_CODE}" -ge 300 ]]; then
  echo "Deploy failed. HTTP ${HTTP_CODE}"
  cat "${RESPONSE_FILE}"
  rm -f "${RESPONSE_FILE}"
  exit 1
fi

JSON="$(tr -d '\n' < "${RESPONSE_FILE}")"
rm -f "${RESPONSE_FILE}"

DEPLOY_ID="$(printf "%s" "${JSON}" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' | head -n 1)"
DEPLOY_URL="$(printf "%s" "${JSON}" | sed -n 's/.*"deploy_ssl_url":"\([^"]*\)".*/\1/p' | head -n 1)"
SITE_URL="$(printf "%s" "${JSON}" | sed -n 's/.*"ssl_url":"\([^"]*\)".*/\1/p' | head -n 1)"

echo "[3/3] Deploy request accepted."
echo "Site URL: ${SITE_URL:-unknown}"
echo "Deploy URL: ${DEPLOY_URL:-unknown}"
echo "Deploy ID: ${DEPLOY_ID:-unknown}"
echo "Archive: ${ZIP_PATH}"
echo "Staging dir: ${STAGE_DIR}"
