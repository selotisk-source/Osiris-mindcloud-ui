function createRequestInit(init = {}) {
  const headers = new Headers(init.headers || {});
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;

  if (isFormData) {
    // Fetch must generate the multipart Content-Type including its boundary.
    headers.delete("content-type");
  } else if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  return { ...init, headers };
}

module.exports = { createRequestInit };
