const fs = require("fs/promises");
const path = require("path");

const { CALENDARS, fetchUrl } = require("../server.js");

const DATA_DIR = path.join(__dirname, "..", "data");

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function syncStaticData() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  const staleCalendars = [];
  console.log(`Syncing ${CALENDARS.length} calendar snapshots into ${DATA_DIR}`);

  for (const [id, calendar] of CALENDARS.entries()) {
    const filePath = path.join(DATA_DIR, `calendar-${id}.ics`);
    try {
      console.log(`Fetching [${id}] ${calendar.name}`);
      const icsData = await fetchUrl(calendar.url);
      if (!icsData.includes("BEGIN:VCALENDAR")) {
        throw new Error("Not a valid iCal response");
      }
      await fs.writeFile(filePath, icsData, "utf8");
    } catch (error) {
      if (await fileExists(filePath)) {
        console.warn(`Keeping existing snapshot for [${id}] ${calendar.name}: ${error.message}`);
        staleCalendars.push({ id, name: calendar.name, error: error.message });
        continue;
      }
      throw new Error(`Failed to fetch ${calendar.name}: ${error.message}`);
    }
  }

  const calendarsIndex = CALENDARS.map((calendar, id) => ({
    id,
    name: calendar.name,
    sourcePath: `calendar-${id}.ics`,
  }));
  const manifest = {
    generatedAt: new Date().toISOString(),
    calendarCount: CALENDARS.length,
    staleCalendars,
  };

  await fs.writeFile(
    path.join(DATA_DIR, "calendars.json"),
    `${JSON.stringify(calendarsIndex, null, 2)}\n`,
    "utf8"
  );
  await fs.writeFile(
    path.join(DATA_DIR, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );

  if (staleCalendars.length) {
    console.warn(`Completed with ${staleCalendars.length} stale snapshot(s).`);
  } else {
    console.log("Calendar snapshots are up to date.");
  }
}

syncStaticData().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
