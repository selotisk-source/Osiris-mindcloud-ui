FROM cognee/cognee:main
# Railway mounts volumes with root ownership. Repair the mount ownership at
# container startup, then drop privileges back to the image's "cognee" user.
USER root
COPY deploy/cognee/railway-entrypoint.sh /railway-entrypoint.sh
RUN chmod 0755 /railway-entrypoint.sh
ENTRYPOINT ["/railway-entrypoint.sh"]

# Railway performs its own deployment health probe.
HEALTHCHECK NONE
