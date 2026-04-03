// Simple static preview server for local development.
// Usage: node server.js
// Then open http://localhost:3000 in your browser

const http = require("http");
const fs = require("fs");
const path = require("path");

const HOST = process.env.HOST || "127.0.0.1";
const PORT = process.env.PORT || 3000;
const LOCATION_ROUTES = new Set(["/albufeira", "/portimao", "/mama"]);
const LOCATION_ROUTE_FILES = new Map();
for (const routePath of LOCATION_ROUTES) {
  const filePath = `${routePath.slice(1)}/index.html`;
  LOCATION_ROUTE_FILES.set(routePath, filePath);
  LOCATION_ROUTE_FILES.set(`${routePath}/index.html`, filePath);
}

function normalizePathname(pathname) {
  if (!pathname || pathname === "/") return "/";
  return pathname.replace(/\/+$/, "");
}

function serveStaticFile(req, res, file, mime) {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    res.writeHead(200, { "Content-Type": mime });
    if (req.method === "HEAD") {
      res.end();
      return true;
    }

    res.end(fs.readFileSync(filePath));
    return true;
  }

  res.writeHead(404);
  res.end(`${file} not found — make sure all files are in the same folder as server.js`);
  return false;
}

function mimeForFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".txt") return "text/plain; charset=utf-8";
  return "text/html; charset=utf-8";
}

function serveRepoFile(req, res, relativePath) {
  return serveStaticFile(req, res, relativePath, mimeForFile(relativePath));
}

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const rawPathname = requestUrl.pathname || "/";
  const pathname = normalizePathname(rawPathname);

  res.setHeader(
    "X-Robots-Tag",
    "noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate, max-image-preview:none, max-snippet:0, max-video-preview:0"
  );

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" });
    res.end();
    return;
  }

  if (LOCATION_ROUTES.has(pathname) && rawPathname !== `${pathname}/`) {
    res.writeHead(301, { Location: `${pathname}/` });
    res.end();
    return;
  }

  if (pathname === "/" || pathname === "/index.html") {
    serveRepoFile(req, res, "index.html");
    return;
  }

  if (LOCATION_ROUTE_FILES.has(pathname)) {
    serveRepoFile(req, res, LOCATION_ROUTE_FILES.get(pathname));
    return;
  }

  const STATIC = {
    "/style.css": "style.css",
    "/main.js": "main.js",
    "/robots.txt": "robots.txt",
    "/.nojekyll": ".nojekyll",
  };

  if (STATIC[pathname]) {
    serveRepoFile(req, res, STATIC[pathname]);
    return;
  }

  if (pathname.startsWith("/data/")) {
    const relativePath = pathname.slice(1);
    serveRepoFile(req, res, relativePath);
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`\nStatic preview running at http://${HOST}:${PORT}`);
    console.log(`Open http://${HOST}:${PORT} in your browser\n`);
  });
}

module.exports = {
  LOCATION_ROUTES,
  normalizePathname,
  server,
};
