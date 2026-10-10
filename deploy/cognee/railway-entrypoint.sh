#!/bin/sh
set -eu

# Railway mounts persistent volumes as root-owned directories. Cognee runs as
# UID 1000 (user "cognee"), so grant it ownership before dropping privileges.
mkdir -p /data
chown cognee:cognee /data

# The upstream image's /app/.env contains blank defaults that override Railway
# variables (notably EMBEDDING_BATCH_SIZE=), causing /health to return HTTP 503.
# Patch only non-secret runtime tuning keys before the upstream entrypoint loads it.
ENV_FILE=/app/.env
touch "$ENV_FILE"
set_env() {
  key="$1"
  value="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}
set_env EMBEDDING_BATCH_SIZE 1
set_env GRAPH_EXTRACTOR llm
set_env GLINER_INFERENCE_THREADS 1
set_env AUTO_FEEDBACK false
set_env IMPROVE_AUTO_ENABLED false
set_env FASTEMBED_CACHE_PATH /data/fastembed_cache
set_env HF_HOME /data/huggingface_cache
set_env TRANSFORMERS_CACHE /data/huggingface_cache
set_env TOKENIZERS_PARALLELISM false
set_env OMP_NUM_THREADS 1
set_env MKL_NUM_THREADS 1
set_env OPENBLAS_NUM_THREADS 1
set_env NUMEXPR_NUM_THREADS 1
set_env CHUNK_SIZE 512
set_env TRIPLET_EMBEDDING false
mkdir -p /data/fastembed_cache /data/huggingface_cache
chown cognee:cognee /data/fastembed_cache /data/huggingface_cache

# Keep Cognee's own entrypoint/migration logic, but run it as the non-root user.
exec su -p -s /bin/sh cognee -c 'exec /app/entrypoint.sh'
