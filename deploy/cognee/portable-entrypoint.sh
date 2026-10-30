#!/bin/sh
set -eu

DATA_DIR="${COGNEE_DATA_DIR:-/data}"
mkdir -p "$DATA_DIR" "$DATA_DIR/fastembed_cache" "$DATA_DIR/huggingface_cache"
chown cognee:cognee "$DATA_DIR" "$DATA_DIR/fastembed_cache" "$DATA_DIR/huggingface_cache"

# The upstream image ships blank tuning values in /app/.env. Normalize only
# non-secret runtime settings so those blanks cannot override container ENV.
ENV_FILE=/app/.env
touch "$ENV_FILE"
set_env() {
  key="$1"
  value="$2"
  if grep -q "^\${key}=" "$ENV_FILE"; then
    sed -i "s|^\${key}=.*|\${key}=\${value}|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}
set_env EMBEDDING_BATCH_SIZE "${EMBEDDING_BATCH_SIZE:-1}"
set_env GRAPH_EXTRACTOR "${GRAPH_EXTRACTOR:-llm}"
set_env GLINER_INFERENCE_THREADS "${GLINER_INFERENCE_THREADS:-1}"
set_env AUTO_FEEDBACK "${AUTO_FEEDBACK:-false}"
set_env IMPROVE_AUTO_ENABLED "${IMPROVE_AUTO_ENABLED:-false}"
set_env FASTEMBED_CACHE_PATH "$DATA_DIR/fastembed_cache"
set_env HF_HOME "$DATA_DIR/huggingface_cache"
set_env TRANSFORMERS_CACHE "$DATA_DIR/huggingface_cache"
set_env TOKENIZERS_PARALLELISM "${TOKENIZERS_PARALLELISM:-false}"
set_env OMP_NUM_THREADS "${OMP_NUM_THREADS:-1}"
set_env MKL_NUM_THREADS "${MKL_NUM_THREADS:-1}"
set_env OPENBLAS_NUM_THREADS "${OPENBLAS_NUM_THREADS:-1}"
set_env NUMEXPR_NUM_THREADS "${NUMEXPR_NUM_THREADS:-1}"
set_env CHUNK_SIZE "${CHUNK_SIZE:-512}"
set_env TRIPLET_EMBEDDING "${TRIPLET_EMBEDDING:-false}"

# Run the upstream migrations/startup as the non-root Cognee account.
exec su -p -s /bin/sh cognee -c 'exec /app/entrypoint.sh'
