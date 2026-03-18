#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_SCRIPT="${ROOT_DIR}/scripts/deploy-netlify.sh"
POLL_INTERVAL_SECONDS="${POLL_INTERVAL_SECONDS:-3}"
AUTO_DEPLOY_INITIAL="${AUTO_DEPLOY_INITIAL:-1}"

if [[ ! -x "${DEPLOY_SCRIPT}" ]]; then
  echo "Error: ${DEPLOY_SCRIPT} is not executable."
  exit 1
fi

calc_hash() {
  find "${ROOT_DIR}" \
    -path "${ROOT_DIR}/deploy" -prune -o \
    -path "${ROOT_DIR}/.git" -prune -o \
    -name ".DS_Store" -prune -o \
    -type f -print0 \
    | sort -z \
    | xargs -0 shasum \
    | shasum \
    | awk '{print $1}'
}

echo "Auto deploy is running. Press Ctrl+C to stop."
if [[ "${AUTO_DEPLOY_INITIAL}" == "1" ]]; then
  echo "Running initial deploy..."
  if "${DEPLOY_SCRIPT}"; then
    echo "Initial deploy request sent."
  else
    echo "Initial deploy failed. Watch mode will continue."
  fi
fi

LAST_HASH="$(calc_hash)"
echo "Watching for file changes..."

while true; do
  sleep "${POLL_INTERVAL_SECONDS}"
  NEW_HASH="$(calc_hash)"

  if [[ "${NEW_HASH}" != "${LAST_HASH}" ]]; then
    echo "Change detected. Starting deploy..."
    if "${DEPLOY_SCRIPT}"; then
      echo "Deploy request sent."
    else
      echo "Deploy failed. Check output above."
    fi
    LAST_HASH="${NEW_HASH}"
  fi
done
