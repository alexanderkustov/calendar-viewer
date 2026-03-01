// Simple iCal proxy server — bypasses CORS for Airbnb iCal URLs
// Usage: node server.js
// Then open http://localhost:3000 in your browser

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = process.env.PORT || 3000;

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
  {
    name: "Antero A7 booking",
    url: "https://ical.booking.com/v1/export?t=1e498d5c-9764-48b7-9a24-c4a2bb122a81"
  }
];

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
          // Handle redirects
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

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);

    // Password protection removed — all routes accessible

  // CORS headers for all responses
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Serve static files (index.html, style.css, main.js)
  const STATIC = {
    "/":           { file: "index.html", mime: "text/html; charset=utf-8" },
    "/index.html": { file: "index.html", mime: "text/html; charset=utf-8" },
    "/style.css":  { file: "style.css",  mime: "text/css; charset=utf-8" },
    "/main.js":    { file: "main.js",    mime: "application/javascript; charset=utf-8" },
  };

  if (STATIC[parsedUrl.pathname]) {
    const { file, mime } = STATIC[parsedUrl.pathname];
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      res.writeHead(200, { "Content-Type": mime });
      res.end(fs.readFileSync(filePath));
    } else {
      res.writeHead(404);
      res.end(`${file} not found — make sure all files are in the same folder as server.js`);
    }
    return;
  }

  // API: return calendar list
  if (parsedUrl.pathname === "/api/calendars") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(CALENDARS.map((c, i) => ({ id: i, name: c.name }))));
    return;
  }

  // API: proxy a calendar by index
  if (parsedUrl.pathname === "/api/ical") {
    const id = parseInt(parsedUrl.query.id, 10);
    if (isNaN(id) || id < 0 || id >= CALENDARS.length) {
      res.writeHead(400, { "Content-Type": "application/json" });
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
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`\n✅  iCal proxy running at http://localhost:${PORT}`);
  console.log(`   Open http://localhost:${PORT} in your browser\n`);
  CALENDARS.forEach((c, i) => console.log(`   Calendar ${i}: ${c.name}`));
  console.log();
});
