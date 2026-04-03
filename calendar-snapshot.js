const https = require("https");

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
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return fetchUrl(res.headers.location).then(resolve).catch(reject);
          }

          let data = "";
          res.on("data", (chunk) => {
            data += chunk;
          });
          res.on("end", () => resolve(data));
        }
      )
      .on("error", reject);
  });
}

function validateCalendarSnapshot(icsData) {
  if (typeof icsData !== "string") {
    throw new Error("Calendar response was not text");
  }

  if (!icsData.includes("BEGIN:VCALENDAR") || !icsData.includes("END:VCALENDAR")) {
    throw new Error("Not a valid iCal response");
  }
}

function normalizeICSText(text) {
  return text.replace(/\r\n[ \t]/g, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function unescapeICSText(value) {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function formatDateOnly(rawValue) {
  if (!/^\d{8}$/.test(rawValue)) {
    throw new Error(`Unsupported iCal date value: ${rawValue}`);
  }

  return `${rawValue.slice(0, 4)}-${rawValue.slice(4, 6)}-${rawValue.slice(6, 8)}`;
}

function formatDateTime(rawValue) {
  const isUtc = rawValue.endsWith("Z");
  const baseValue = isUtc ? rawValue.slice(0, -1) : rawValue;

  if (!/^\d{8}T\d{6}$/.test(baseValue)) {
    throw new Error(`Unsupported iCal datetime value: ${rawValue}`);
  }

  const formatted = `${baseValue.slice(0, 4)}-${baseValue.slice(4, 6)}-${baseValue.slice(6, 8)}T${baseValue.slice(9, 11)}:${baseValue.slice(11, 13)}:${baseValue.slice(13, 15)}`;
  return {
    type: isUtc ? "utc-datetime" : "local-datetime",
    value: `${formatted}${isUtc ? "Z" : ""}`,
  };
}

function parseICSDateValue(rawValue, keyFull) {
  const value = rawValue.trim();

  if (/VALUE=DATE/i.test(keyFull) || /^\d{8}$/.test(value)) {
    return {
      type: "date",
      value: formatDateOnly(value),
    };
  }

  return formatDateTime(value);
}

function compareSnapshotValues(left, right) {
  const leftValue = `${left?.type || ""}:${left?.value || ""}`;
  const rightValue = `${right?.type || ""}:${right?.value || ""}`;
  if (leftValue < rightValue) return -1;
  if (leftValue > rightValue) return 1;
  return 0;
}

function parseICSToSnapshot(icsData) {
  const events = [];
  let currentEvent = null;

  for (const rawLine of normalizeICSText(icsData).split("\n")) {
    const line = rawLine.trim();

    if (line === "BEGIN:VEVENT") {
      currentEvent = {};
      continue;
    }

    if (line === "END:VEVENT") {
      if (currentEvent && currentEvent.start && currentEvent.end) {
        events.push(currentEvent);
      }
      currentEvent = null;
      continue;
    }

    if (!currentEvent) {
      continue;
    }

    const separatorIndex = line.indexOf(":");
    if (separatorIndex < 0) {
      continue;
    }

    const keyFull = line.slice(0, separatorIndex);
    const key = keyFull.split(";")[0].toUpperCase();
    const value = line.slice(separatorIndex + 1);

    if (key === "SUMMARY") {
      currentEvent.summary = unescapeICSText(value);
    }

    if (key === "DTSTART") {
      currentEvent.start = parseICSDateValue(value, keyFull);
    }

    if (key === "DTEND") {
      currentEvent.end = parseICSDateValue(value, keyFull);
    }
  }

  events.sort((left, right) => {
    return compareSnapshotValues(left.start, right.start) || compareSnapshotValues(left.end, right.end);
  });

  return events;
}

function buildCalendarSnapshot(icsData) {
  validateCalendarSnapshot(icsData);
  return parseICSToSnapshot(icsData);
}

module.exports = {
  buildCalendarSnapshot,
  fetchUrl,
  validateCalendarSnapshot,
};
