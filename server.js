// Simple iCal proxy server — bypasses CORS for Airbnb iCal URLs
// Usage: node server.js

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = process.env.PORT || 3000;
const PASSWORD = process.env.APP_PASSWORD || "airbnb100calcas";
const DIST_DIR = path.join(__dirname, "dist");

const CALENDARS = [
  {
    name: "Pardais 205",
    url: "https://www.airbnb.co.uk/calendar/ical/1611613204985424515.ics?t=df544aebf2d54f7589a5228ca5037c18",
  },
  {
    name: "Silchoro 1205",
    url: "https://www.airbnb.co.uk/calendar/ical/830105480167579378.ics?t=6942d1db89f54918902b6ac1d4ed1c04",
  },
  {
    name: "Antero A7",
    url: "https://www.airbnb.co.uk/calendar/ical/914217783547257427.ics?t=bfe3347170624f688de258fc9e81590c",
  },
];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
};

function fetchUrl(targetUrl) {
  return new Promise((resolve, reject) => {
    https
      .get(
        targetUrl,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; iCalFetcher/1.0)",
          },
        },
        (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return fetchUrl(res.headers.location).then(resolve).catch(reject);
          }
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => resolve(data));
        }
      )
      .on("error", reject);
  });
}

function sendFile(res, filePath) {
  if (!fs.existsSync(filePath)) return false;
  const ext = path.extname(filePath);
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  res.end(fs.readFileSync(filePath));
  return true;
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "x-password, Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const passwordFromQuery = parsedUrl.query.password;
  const passwordFromHeader = req.headers["x-password"];
  const isPasswordValid = passwordFromQuery === PASSWORD || passwordFromHeader === PASSWORD;
  if (!isPasswordValid) {
    res.writeHead(401, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Unauthorized: Password required");
    return;
  }

  if (parsedUrl.pathname === "/api/calendars") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(CALENDARS.map((c, i) => ({ id: i, name: c.name }))));
    return;
  }

  if (parsedUrl.pathname === "/api/ical") {
    const id = parseInt(parsedUrl.query.id, 10);
    if (isNaN(id) || id < 0 || id >= CALENDARS.length) {
      res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "Invalid calendar id" }));
      return;
    }

    try {
      console.log(`Fetching calendar ${id}: ${CALENDARS[id].name}`);
      const icsData = await fetchUrl(CALENDARS[id].url);
      res.writeHead(200, { "Content-Type": "text/calendar; charset=utf-8" });
      res.end(icsData);
    } catch (err) {
      console.error(`Error fetching calendar ${id}:`, err.message);
      res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  const safePath = path.normalize(parsedUrl.pathname || "/").replace(/^\/+/g, "");
  const assetPath = path.join(DIST_DIR, safePath);
  if (safePath && fs.existsSync(assetPath) && fs.statSync(assetPath).isFile()) {
    sendFile(res, assetPath);
    return;
  }

  if (sendFile(res, path.join(DIST_DIR, "index.html"))) {
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not found. Build the frontend first with: npm run build");
});

server.listen(PORT, () => {
  console.log(`\n✅ iCal proxy running at http://localhost:${PORT}`);
  console.log("   Use `npm run dev` for Vite dev server and `npm run build` for production assets.\n");
});
