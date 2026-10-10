#!/bin/sh
set -eu

# Railway mounts persistent volumes as root-owned directories. Cognee runs as
# UID 1000 (user "cognee"), so grant it ownership before dropping privileges.
mkdir -p /data
chown cognee:cognee /data

# Keep Cognee's own entrypoint/migration logic, but run it as the non-root user.
exec su -s /bin/sh cognee -c 'exec /app/entrypoint.sh'
