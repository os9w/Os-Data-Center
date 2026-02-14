import express from "express";
import fs from "fs/promises";
import path from "path";

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static("public"));

const DATA_DIR = path.join(process.cwd(), "data");
const COUNTERS_FILE = path.join(DATA_DIR, "counters.json");

function safeText(value, maxLen) {
  return String(value ?? "").trim().slice(0, maxLen);
}

// Turn Arabic region label into:
// - regionKey: safe folder name (ascii)
// - regionPrefix: Arabic first-letter (after removing "منطقة" / "المنطقة" / "ال")
const REGION_MAP = {
  "منطقة الرياض": { key: "riyadh", prefix: "ر" },
  "منطقة مكة المكرمة": { key: "makkah", prefix: "م" },
  "منطقة المدينة المنورة": { key: "madinah", prefix: "م" }, // same prefix is OK because each region has its own database folder
  "منطقة القصيم": { key: "qassim", prefix: "ق" },
  "المنطقة الشرقية": { key: "eastern", prefix: "ش" }, // الشرقية -> ش
  "منطقة عسير": { key: "asir", prefix: "ع" },
  "منطقة تبوك": { key: "tabuk", prefix: "ت" },
  "منطقة حائل": { key: "hail", prefix: "ح" },
  "منطقة الحدود الشمالية": { key: "northern", prefix: "ح" }, // الحدود -> ح
  "منطقة جازان": { key: "jazan", prefix: "ج" },
  "منطقة نجران": { key: "najran", prefix: "ن" },
  "منطقة الباحة": { key: "bahah", prefix: "ب" },
  "منطقة الجوف": { key: "jouf", prefix: "ج" }
};

async function loadCounters() {
  try {
    const raw = await fs.readFile(COUNTERS_FILE, "utf8");
    const obj = JSON.parse(raw);
    if (obj && typeof obj === "object") return obj;
    return {};
  } catch {
    return {};
  }
}

async function saveCounters(counters) {
  await fs.writeFile(COUNTERS_FILE, JSON.stringify(counters, null, 2), "utf8");
}

app.post("/save", async (req, res) => {
  try {
    const name = safeText(req.body.name, 100);
    const phone = safeText(req.body.phone, 30);
    const email = safeText(req.body.email, 120);
    const regionLabel = safeText(req.body.region, 50);

    if (!name || !phone || !email || !regionLabel) {
      return res.status(400).json({ error: "All fields are required." });
    }

    const regionInfo = REGION_MAP[regionLabel];
    if (!regionInfo) {
      return res.status(400).json({ error: "Invalid region selected." });
    }

    // Ensure base data folder exists
    await fs.mkdir(DATA_DIR, { recursive: true });

    // Each region has its own "database" folder
    const regionFolder = path.join(DATA_DIR, regionInfo.key);
    await fs.mkdir(regionFolder, { recursive: true });

    // Counters stored in data/counters.json
    const counters = await loadCounters();
    const last = Number(counters[regionInfo.key] ?? 0);
    const next = last + 1;

    counters[regionInfo.key] = next;
    await saveCounters(counters);

    // ID format: prefix + number (example: ر1, ش2, م15 ...)
    const id = `${regionInfo.prefix}${next}`;
    const filename = `${id}.json`;
    const filepath = path.join(regionFolder, filename);

    const record = {
      id,
      name,
      phone,
      email,
      region: regionLabel,
      savedAt: new Date().toISOString()
    };

    await fs.writeFile(filepath, JSON.stringify(record, null, 2), "utf8");

    return res.json({ ok: true }); // not showing ID to the user
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error saving file." });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
