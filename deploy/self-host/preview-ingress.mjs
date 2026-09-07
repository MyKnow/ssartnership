// No credentials, Docker socket or dynamic upstreams. Only this ingress joins
// an external bridge; the Preview application and data services stay internal.
import http from "node:http";
const hop = new Set(["connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade"]);
function forward(port, hostname, upstreamPort) {
  const server = http.createServer((request, response) => {
    if (!request.url?.startsWith("/") || request.url.startsWith("//") || request.method === "CONNECT") {
      response.writeHead(400).end(); return;
    }
    const excluded = new Set([...hop, ...String(request.headers.connection ?? "").toLowerCase().split(",").map(s => s.trim())]);
    const headers = Object.fromEntries(Object.entries(request.headers).filter(([name]) => !excluded.has(name) && !name.startsWith("x-forwarded-") && name !== "forwarded"));
    const upstream = http.request({ hostname, port: upstreamPort, method: request.method, path: request.url, headers, timeout: 60_000 }, incoming => {
      response.writeHead(incoming.statusCode ?? 502, Object.fromEntries(Object.entries(incoming.headers).filter(([name]) => !hop.has(name))));
      incoming.on("error", () => response.destroy());
      incoming.pipe(response);
    });
    upstream.on("timeout", () => upstream.destroy());
    upstream.on("error", () => { if (!response.headersSent) response.writeHead(502).end(); else response.destroy(); });
    request.on("error", () => upstream.destroy());
    response.on("close", () => upstream.destroy());
    let bytes = 0;
    request.on("data", chunk => {
      bytes += chunk.length;
      if (bytes > 54 * 1024 * 1024) { if (!response.headersSent) response.writeHead(413).end(); upstream.destroy(); request.destroy(); }
    });
    request.pipe(upstream);
  });
  server.headersTimeout = 10_000;
  server.requestTimeout = 65_000;
  server.on("clientError", (_, socket) => socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n"));
  server.listen(port, "0.0.0.0");
}
forward(8080, "app", 3000);
forward(8081, "gateway", 8000);
