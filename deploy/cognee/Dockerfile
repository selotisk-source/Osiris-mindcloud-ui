FROM cognee/cognee:main
# Cognee's image declares a 40s Docker healthcheck, while Railway
# performs its own deployment probe. Disable the inherited Docker probe
# so Railway can keep the process alive through Cognee's migration/model
# warm-up phase.
HEALTHCHECK NONE
