const express = require("express");
const path = require("path");
const fs = require("fs/promises");

const PORT = process.env.PORT || 3000;
const SOURCE_PAGE_URL = "https://www.primero.lv/korukari/rezultati";
const SOURCE_API_URL =
  "https://core-x-faktors.eleving.com/api/candidates?order_by=verified_votes_count&order_direction=desc";
const POLL_INTERVAL_MS = 5 * 60 * 1000;
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "snapshots.json");
const MAX_SNAPSHOTS = 5000;

const CITIES = [
  { key: "preili", label: "Preiļi", keywords: ["preil"] },
  { key: "madona", label: "Madona", keywords: ["madon"] },
];

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

let runtimeState = {
  lastRunAt: null,
  lastSuccessAt: null,
  lastError: null,
  isCollecting: false,
};

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    const initial = {
      sourcePageUrl: SOURCE_PAGE_URL,
      sourceApiUrl: SOURCE_API_URL,
      createdAt: new Date().toISOString(),
      snapshots: [],
    };
    await fs.writeFile(DATA_FILE, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readStore() {
  await ensureDataFile();
  const text = await fs.readFile(DATA_FILE, "utf8");
  return JSON.parse(text);
}

async function writeStore(store) {
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
}

async function fetchCandidates() {
  const response = await fetch(SOURCE_API_URL, {
    headers: {
      Accept: "application/json",
      "User-Agent": "koru-city-collector/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Source API request failed with HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error("Unexpected source payload: expected an array");
  }

  return payload;
}

function getCityRecords(candidates) {
  return CITIES.map((city) => {
    const matched = candidates.find((candidate) => {
      const haystack = normalizeText(`${candidate.name} ${candidate.description}`);
      return city.keywords.some((keyword) => haystack.includes(keyword));
    });

    if (!matched) {
      return {
        cityKey: city.key,
        city: city.label,
        found: false,
      };
    }

    return {
      cityKey: city.key,
      city: city.label,
      found: true,
      candidateId: matched.id,
      candidateName: matched.name,
      verifiedVotesCount: matched.verified_votes_count,
      isEliminated: matched.is_eliminated,
      image: matched.image,
    };
  });
}

async function collectOnce() {
  if (runtimeState.isCollecting) {
    return { skipped: true, reason: "already_collecting" };
  }

  runtimeState.isCollecting = true;
  runtimeState.lastRunAt = new Date().toISOString();

  try {
    const candidates = await fetchCandidates();
    const records = getCityRecords(candidates);
    const snapshot = {
      collectedAt: new Date().toISOString(),
      sourcePageUrl: SOURCE_PAGE_URL,
      sourceApiUrl: SOURCE_API_URL,
      records,
    };

    const store = await readStore();
    store.snapshots.push(snapshot);
    if (store.snapshots.length > MAX_SNAPSHOTS) {
      store.snapshots = store.snapshots.slice(-MAX_SNAPSHOTS);
    }

    await writeStore(store);

    runtimeState.lastSuccessAt = snapshot.collectedAt;
    runtimeState.lastError = null;
    return { skipped: false, snapshot };
  } catch (error) {
    runtimeState.lastError = {
      message: error.message,
      at: new Date().toISOString(),
    };
    throw error;
  } finally {
    runtimeState.isCollecting = false;
  }
}

app.get("/api/status", async (_req, res) => {
  const store = await readStore();
  res.json({
    ...runtimeState,
    totalSnapshots: store.snapshots.length,
    pollIntervalMs: POLL_INTERVAL_MS,
    sourcePageUrl: SOURCE_PAGE_URL,
  });
});

app.get("/api/snapshots", async (req, res) => {
  const limit = Math.max(1, Math.min(Number(req.query.limit) || 100, 1000));
  const store = await readStore();
  const snapshots = store.snapshots.slice(-limit).reverse();
  res.json({ snapshots, total: store.snapshots.length });
});

app.get("/api/latest", async (_req, res) => {
  const store = await readStore();
  const latest = store.snapshots.at(-1) || null;
  res.json({ latest });
});

app.post("/api/collect", async (_req, res) => {
  try {
    const result = await collectOnce();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function start() {
  await ensureDataFile();

  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
    console.log("Collecting data every 5 minutes...");
  });

  try {
    await collectOnce();
  } catch (error) {
    console.error("Initial collection failed:", error.message);
  }

  setInterval(async () => {
    try {
      await collectOnce();
      console.log(`[${new Date().toISOString()}] Collection complete`);
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] Collection failed:`,
        error.message
      );
    }
  }, POLL_INTERVAL_MS);
}

start().catch((error) => {
  console.error("Fatal startup error:", error);
  process.exit(1);
});
