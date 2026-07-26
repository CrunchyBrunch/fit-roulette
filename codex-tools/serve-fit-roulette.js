const fs = require("fs");
const http = require("http");
const path = require("path");

const port = Number(process.argv[2] || 4173);
const root = path.resolve(__dirname, "..");
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png"
};

http.createServer((request, response) => {
  const url = new URL(request.url, "http://127.0.0.1");
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";

  const filePath = path.join(root, pathname);
  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, buffer) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "content-type": contentTypes[path.extname(filePath)] || "application/octet-stream",
      "cache-control": "no-store"
    });
    response.end(buffer);
  });
}).listen(port, "127.0.0.1", () => {
  console.log(`Fit Roulette server listening on http://127.0.0.1:${port}`);
});
