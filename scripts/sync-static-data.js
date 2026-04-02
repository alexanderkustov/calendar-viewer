const fs = require("fs/promises");
const path = require("path");

const { CALENDARS, fetchUrl } = require("../server.js");

const DATA_DIR = path.join(__dirname, "..", "data");
const FETCH_TIMEOUT_MS = 30_000;
const FETCH_RETRIES = 2;
const FETCH_RETRY_DELAY_MS = 1_500;
const MANAGED_DATA_FILES = new Set(["calendars.json", "manifest.json"]);
const CALENDAR_FILE_PATTERN = /^calendar-\d+\.ics$/;

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function isManagedDataEntry(entryName) {
  return MANAGED_DATA_FILES.has(entryName) || CALENDAR_FILE_PATTERN.test(entryName);
}

function validateCalendarSnapshot(icsData) {
  if (typeof icsData !== "string") {
    throw new Error("Calendar response was not text");
  }

  if (!icsData.includes("BEGIN:VCALENDAR") || !icsData.includes("END:VCALENDAR")) {
    throw new Error("Not a valid iCal response");
  }
}

function formatErrorMessage(error) {
  if (error && typeof error.message === "string" && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  return "Unknown fetch error";
}

async function fetchWithTimeout(targetUrl, timeoutMs = FETCH_TIMEOUT_MS, fetchCalendar = fetchUrl) {
  let timeoutId;

  try {
    return await Promise.race([
      fetchCalendar(targetUrl),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Request timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}

function sleep(delayMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

async function fetchWithRetry(
  targetUrl,
  {
    timeoutMs = FETCH_TIMEOUT_MS,
    retries = FETCH_RETRIES,
    retryDelayMs = FETCH_RETRY_DELAY_MS,
    fetchCalendar = fetchUrl,
    label = "calendar"
  } = {}
) {
  let lastError = null;

  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    try {
      return await fetchWithTimeout(targetUrl, timeoutMs, fetchCalendar);
    } catch (error) {
      lastError = error;

      if (attempt > retries) {
        break;
      }

      const reason = formatErrorMessage(error);
      console.warn(
        `Fetch attempt ${attempt} failed for ${label}; retrying in ${retryDelayMs}ms. ${reason}`
      );
      await sleep(retryDelayMs * attempt);
    }
  }

  throw lastError;
}

async function copyPreservedDataEntries(sourceDir, targetDir) {
  if (!(await pathExists(sourceDir))) {
    return;
  }

  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    if (isManagedDataEntry(entry.name)) {
      continue;
    }

    await fs.cp(
      path.join(sourceDir, entry.name),
      path.join(targetDir, entry.name),
      { force: true, recursive: true }
    );
  }
}

function buildCalendarsIndex(calendars) {
  return calendars.map((calendar, id) => ({
    id,
    name: calendar.name,
    sourcePath: `calendar-${id}.ics`,
  }));
}

function buildManifest(calendars, staleCalendars = [], now = new Date()) {
  return {
    generatedAt: now.toISOString(),
    calendarCount: calendars.length,
    staleCalendarCount: staleCalendars.length,
    staleCalendars,
  };
}

async function restoreExistingCalendarSnapshot({ id, targetDir, existingDataDir }) {
  const filename = `calendar-${id}.ics`;
  const existingPath = path.join(existingDataDir, filename);
  const replacementPath = path.join(targetDir, filename);

  if (!(await pathExists(existingPath))) {
    throw new Error("No previous snapshot available for fallback");
  }

  await fs.copyFile(existingPath, replacementPath);
}

async function writeSnapshotSet(
  targetDir,
  { calendars = CALENDARS, fetchCalendar = fetchUrl, existingDataDir = DATA_DIR } = {}
) {
  await fs.mkdir(targetDir, { recursive: true });
  await copyPreservedDataEntries(existingDataDir, targetDir);
  const staleCalendars = [];

  for (const [id, calendar] of calendars.entries()) {
    console.log(`Fetching [${id}] ${calendar.name}`);
    try {
      const icsData = await fetchWithRetry(calendar.url, {
        timeoutMs: FETCH_TIMEOUT_MS,
        retries: FETCH_RETRIES,
        retryDelayMs: FETCH_RETRY_DELAY_MS,
        fetchCalendar,
        label: `[${id}] ${calendar.name}`
      });
      validateCalendarSnapshot(icsData);
      await fs.writeFile(path.join(targetDir, `calendar-${id}.ics`), icsData, "utf8");
    } catch (error) {
      const reason = formatErrorMessage(error);
      console.warn(
        `Failed to refresh [${id}] ${calendar.name}; preserving previous snapshot. ${reason}`
      );
      await restoreExistingCalendarSnapshot({ id, targetDir, existingDataDir });
      staleCalendars.push({
        id,
        name: calendar.name,
        reason,
      });
    }
  }

  await fs.writeFile(
    path.join(targetDir, "calendars.json"),
    `${JSON.stringify(buildCalendarsIndex(calendars), null, 2)}\n`,
    "utf8"
  );
  await fs.writeFile(
    path.join(targetDir, "manifest.json"),
    `${JSON.stringify(buildManifest(calendars, staleCalendars), null, 2)}\n`,
    "utf8"
  );
}

function buildSwapDirPath(dataDir, label) {
  return path.join(
    path.dirname(dataDir),
    `${path.basename(dataDir)}-${label}-${process.pid}-${Date.now()}`
  );
}

async function replaceDataDirectory(stagedDir, dataDir = DATA_DIR) {
  const existingDataDir = await pathExists(dataDir);
  const backupDir = existingDataDir ? buildSwapDirPath(dataDir, "backup") : null;

  try {
    if (existingDataDir) {
      await fs.rename(dataDir, backupDir);
    }

    await fs.rename(stagedDir, dataDir);

    if (backupDir && (await pathExists(backupDir))) {
      await fs.rm(backupDir, { force: true, recursive: true });
    }
  } catch (error) {
    if (backupDir && (await pathExists(backupDir)) && !(await pathExists(dataDir))) {
      await fs.rename(backupDir, dataDir);
    }

    throw error;
  }
}

async function syncStaticData({
  calendars = CALENDARS,
  fetchCalendar = fetchUrl,
  dataDir = DATA_DIR,
} = {}) {
  const dataParentDir = path.dirname(dataDir);
  const stagedDir = buildSwapDirPath(dataDir, "staged");

  await fs.mkdir(dataParentDir, { recursive: true });
  console.log(`Syncing ${calendars.length} calendar snapshots into ${dataDir}`);

  try {
    await writeSnapshotSet(stagedDir, { calendars, fetchCalendar, existingDataDir: dataDir });
    await replaceDataDirectory(stagedDir, dataDir);
    console.log("Calendar snapshots are up to date.");
  } catch (error) {
    await fs.rm(stagedDir, { force: true, recursive: true });
    throw error;
  }
}

if (require.main === module) {
  syncStaticData().catch((error) => {
    console.error(`Sync failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  DATA_DIR,
  FETCH_RETRIES,
  FETCH_RETRY_DELAY_MS,
  FETCH_TIMEOUT_MS,
  buildCalendarsIndex,
  buildManifest,
  copyPreservedDataEntries,
  fetchWithRetry,
  formatErrorMessage,
  isManagedDataEntry,
  restoreExistingCalendarSnapshot,
  replaceDataDirectory,
  syncStaticData,
  validateCalendarSnapshot,
  writeSnapshotSet,
};
