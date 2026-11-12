#!/bin/sh
set -eu

# Portable Cognee startup for container platforms with mounted persistent storage.
DATA_DIR="${COGNEE_DATA_DIR:-/data}"
APP_ENV_FILE="${COGNEE_ENV_FILE:-/app/.env}"
COGNEE_USER="${COGNEE_USER:-cognee}"

mkdir -p "$DATA_DIR"
if id "$COGNEE_USER" >/dev/null 2>&1; then
  chown -R "$COGNEE_USER":"$COGNEE_USER" "$DATA_DIR"
fi

set_env() {
  key="$1"
  value="$2"
  if [ -f "$APP_ENV_FILE" ] && grep -q "^$key=" "$APP_ENV_FILE"; then
    sed -i "s|^$key=.*|$key=$value|" "$APP_ENV_FILE"
  elif [ -f "$APP_ENV_FILE" ]; then
    printf '%s=%s\n' "$key" "$value" >> "$APP_ENV_FILE"
  fi
}

# Conservative defaults for small persistent instances.
set_env EMBEDDING_BATCH_SIZE "${EMBEDDING_BATCH_SIZE:-1}"
set_env GLINER_INFERENCE_THREADS "${GLINER_INFERENCE_THREADS:-1}"
set_env FASTEMBED_CACHE_PATH "$DATA_DIR/fastembed_cache"
set_env HF_HOME "$DATA_DIR/huggingface_cache"
set_env TRANSFORMERS_CACHE "$DATA_DIR/huggingface_cache"
set_env TOKENIZERS_PARALLELISM "${TOKENIZERS_PARALLELISM:-false}"
set_env OMP_NUM_THREADS "${OMP_NUM_THREADS:-1}"
set_env MKL_NUM_THREADS "${MKL_NUM_THREADS:-1}"

mkdir -p "$DATA_DIR/fastembed_cache" "$DATA_DIR/huggingface_cache"
if id "$COGNEE_USER" >/dev/null 2>&1; then
  chown -R "$COGNEE_USER":"$COGNEE_USER" "$DATA_DIR"
  exec su -p -s /bin/sh "$COGNEE_USER" -c 'exec /app/entrypoint.sh'
fi

exec /app/entrypoint.sh
