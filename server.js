// Simple iCal proxy server — bypasses CORS for Airbnb iCal URLs
// Usage: node server.js
// Then open http://localhost:3000 in your browser

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = process.env.PORT || 3000;
const LOCATION_ROUTES = new Set(["/albufeira", "/portimao", "/mama"]);

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
  },
  {
    name: "Portimao J138",
    url: "https://www.airbnb.co.uk/calendar/ical/1635428772732094156.ics?t=f7047724c87e4449917c247332bf465f"
  },
  {
    name: "Portimao G137",
    url: "https://www.airbnb.co.uk/calendar/ical/1635425171512419857.ics?t=88790fa90b9c4231bab4773dd37fae23"
  },
  {
    name: "Raul 24",
    url: "https://www.airbnb.com/calendar/ical/48891793.ics?t=73cfb63e849d437687262fb8e2525013"
  },
  {
    name: "Raul 24 - 3 Floor",
    url: "https://www.airbnb.com/calendar/ical/1357204030957836095.ics?t=4a8279ab1e014db0bac53800abd50c89"
  },
  {
    name: "Eulalia",
    url: "https://www.airbnb.com/calendar/ical/1227650987862879407.ics?t=b7075d6ad7574d658c57351d3da09b85"
  },
  {
    name: "Balaia 1",
    url: "https://www.airbnb.com/calendar/ical/860089921432271203.ics?t=174efa0cf3ea4db2b8f236c91774fec6"
  },
  {
    name: "Balaia 2",
    url: "https://www.airbnb.com/calendar/ical/885874220580116381.ics?t=7be98b967ae84a8491a876d8aa833b43"
  },
  {
    name: "Onda Verde",
    url: "https://www.airbnb.com/calendar/ical/1171811513640036311.ics?t=447e008057484ff9a138b8f44bab0678"
  },
  {
    name: "Aljezur",
    url: "https://www.airbnb.com/calendar/ical/40546691.ics?t=d7172bfa75f1444e978602763734f7c0"
  },
  {
    name: "Pescadores",
    url: "https://www.airbnb.com/calendar/ical/794191503164393359.ics?t=2402cd489f8143a69f3e3101c9511f4f"
  },
  {
    name: "Paraiso",
    url: "https://www.airbnb.com/calendar/ical/1578004322904051113.ics?t=9d7253ba27e94560b1358ed2b73d174c"
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

function normalizePathname(pathname) {
  if (!pathname || pathname === "/") return "/";
  return pathname.replace(/\/+$/, "");
}

function serveStaticFile(res, file, mime) {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    res.writeHead(200, { "Content-Type": mime });
    res.end(fs.readFileSync(filePath));
    return true;
  }

  res.writeHead(404);
  res.end(`${file} not found — make sure all files are in the same folder as server.js`);
  return false;
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = normalizePathname(parsedUrl.pathname);

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
  if (pathname === "/" || pathname === "/index.html" || LOCATION_ROUTES.has(pathname)) {
    serveStaticFile(res, "index.html", "text/html; charset=utf-8");
    return;
  }

  const STATIC = {
    "/style.css": { file: "style.css", mime: "text/css; charset=utf-8" },
    "/main.js": { file: "main.js", mime: "application/javascript; charset=utf-8" },
  };

  if (STATIC[pathname]) {
    const { file, mime } = STATIC[pathname];
    serveStaticFile(res, file, mime);
    return;
  }

  // API: return calendar list
  if (pathname === "/api/calendars") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(CALENDARS.map((c, i) => ({ id: i, name: c.name }))));
    return;
  }

  // API: proxy a calendar by index
  if (pathname === "/api/ical") {
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
