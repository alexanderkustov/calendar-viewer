// Simple iCal proxy server — bypasses CORS for Airbnb iCal URLs
// Usage: node server.js
// Then open http://localhost:3000 in your browser

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const LOCATION_ROUTES = new Set(["/albufeira", "/portimao", "/mama"]);
const LOCATION_ROUTE_FILES = new Map();
for (const routePath of LOCATION_ROUTES) {
  const filePath = `${routePath.slice(1)}/index.html`;
  LOCATION_ROUTE_FILES.set(routePath, filePath);
  LOCATION_ROUTE_FILES.set(`${routePath}/index.html`, filePath);
}

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
    name: "Raul 24 - 1",
    url: "https://www.airbnb.com/calendar/ical/48891793.ics?t=73cfb63e849d437687262fb8e2525013"
  },
  {
    name: "Raul 24 - 3",
    url: "https://www.airbnb.com/calendar/ical/1357204030957836095.ics?t=4a8279ab1e014db0bac53800abd50c89"
  },
  {
    name: "Balaia 404",
    url: "https://www.airbnb.com/calendar/ical/860089921432271203.ics?t=174efa0cf3ea4db2b8f236c91774fec6"
  },
  {
    name: "Balaia 405",
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
  },
  {
    name: "Eulalia",
    url: "https://www.airbnb.com/calendar/ical/1227650987862879407.ics?t=b7075d6ad7574d658c57351d3da09b85"
  }
];

function fetchUrl(targetUrl) {
  const sep = targetUrl.includes("?") ? "&" : "?";
  const bustedUrl = `${targetUrl}${sep}_cb=${Date.now()}`;

  return new Promise((resolve, reject) => {
    https
      .get(
        bustedUrl,
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

function mimeForFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".ics") return "text/calendar; charset=utf-8";
  if (ext === ".txt") return "text/plain; charset=utf-8";
  return "text/html; charset=utf-8";
}

function serveRepoFile(res, relativePath) {
  return serveStaticFile(res, relativePath, mimeForFile(relativePath));
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const rawPathname = requestUrl.pathname || "/";
  const pathname = normalizePathname(rawPathname);

  // Password protection removed — all routes accessible

  // CORS headers for all responses
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader(
    "X-Robots-Tag",
    "noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate, max-image-preview:none, max-snippet:0, max-video-preview:0"
  );

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Serve static files (index.html, style.css, main.js)
  if (LOCATION_ROUTES.has(pathname) && rawPathname !== `${pathname}/`) {
    res.writeHead(301, { Location: `${pathname}/` });
    res.end();
    return;
  }

  if (pathname === "/" || pathname === "/index.html") {
    serveRepoFile(res, "index.html");
    return;
  }

  if (LOCATION_ROUTE_FILES.has(pathname)) {
    serveRepoFile(res, LOCATION_ROUTE_FILES.get(pathname));
    return;
  }

  const STATIC = {
    "/style.css": "style.css",
    "/main.js": "main.js",
    "/robots.txt": "robots.txt",
  };

  if (STATIC[pathname]) {
    serveRepoFile(res, STATIC[pathname]);
    return;
  }

  if (pathname.startsWith("/data/")) {
    const relativePath = pathname.slice(1);
    serveRepoFile(res, relativePath);
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
    const id = parseInt(requestUrl.searchParams.get("id"), 10);
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

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`\n✅  iCal proxy running at http://localhost:${PORT}`);
    console.log(`   Open http://localhost:${PORT} in your browser\n`);
    CALENDARS.forEach((c, i) => console.log(`   Calendar ${i}: ${c.name}`));
    console.log();
  });
}

module.exports = {
  CALENDARS,
  LOCATION_ROUTES,
  fetchUrl,
  normalizePathname,
  server,
};
