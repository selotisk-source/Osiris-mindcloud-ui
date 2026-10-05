const http = require("node:http");

const port = Number(process.env.PORT || 3000);

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>OSIRIS MindCloud</title>
</head>
<body>
  <main>
    <h1>OSIRIS MindCloud</h1>
    <p>MindCloud runtime is online.</p>
    <p>Deployment entrypoint is operational.</p>
  </main>
</body>
</html>`;

function cctvResponse() {
  const source = process.env.CCTV_SOURCE_URL || null;
  return {
    status: source ? "configured" : "not_configured",
    service: "osiris-mindcloud-ui",
    endpoint: "/api/cctv",
    source: source ? "configured" : null,
    streamStatus: source ? "configured" : "unconfigured",
    proxyStatus: "not_implemented"
  };
}

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ status: "ok", service: "osiris-mindcloud-ui" }));
    return;
  }

  if (req.url === "/api/cctv") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(cctvResponse()));
    return;
  }

  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`OSIRIS MindCloud listening on port ${port}`);
});
