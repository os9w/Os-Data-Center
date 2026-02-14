import express from "express";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;

// Fix for ES modules (__dirname replacement)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Root route (fixes Cannot GET /)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ================= MongoDB =================

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI not set");
}

mongoose.connect(MONGODB_URI)
  .then(() => console.log("✅ Connected to MongoDB Atlas"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

// ================= Regions =================

const REGION_MAP = {
  "منطقة الرياض": { key: "riyadh", prefix: "ر" },
  "منطقة مكة المكرمة": { key: "makkah", prefix: "م" },
  "منطقة المدينة المنورة": { key: "madinah", prefix: "د" },
  "منطقة القصيم": { key: "qassim", prefix: "ق" },
  "المنطقة الشرقية": { key: "eastern", prefix: "ش" },
  "منطقة عسير": { key: "asir", prefix: "ع" },
  "منطقة تبوك": { key: "tabuk", prefix: "ت" },
  "منطقة حائل": { key: "hail", prefix: "ح" },
  "منطقة الحدود الشمالية": { key: "northern", prefix: "ن" },
  "منطقة جازان": { key: "jazan", prefix: "ج" },
  "منطقة نجران": { key: "najran", prefix: "ن" },
  "منطقة الباحة": { key: "bahah", prefix: "ب" },
  "منطقة الجوف": { key: "jouf", prefix: "ج" }
};

function safeText(value, maxLen) {
  return String(value ?? "").trim().slice(0, maxLen);
}

// ================= Schemas =================

const counterSchema = new mongoose.Schema({
  regionKey: { type: String, unique: true },
  seq: { type: Number, default: 0 }
});

const Counter = mongoose.model("Counter", counterSchema);

const submissionSchema = new mongoose.Schema({
  id: String,
  seq: Number,
  regionKey: String,
  regionLabel: String,
  prefix: String,
  name: String,
  phone: String,
  email: String,
  createdAt: { type: Date, default: Date.now }
});

const Submission = mongoose.model("Submission", submissionSchema);

// ================= Save Route =================

app.post("/save", async (req, res) => {
  try {
    const name = safeText(req.body.name, 100);
    const phone = safeText(req.body.phone, 30);
    const email = safeText(req.body.email, 120);
    const regionLabel = safeText(req.body.region, 50);

    if (!name || !phone || !email || !regionLabel) {
      return res.status(400).json({ error: "All fields required" });
    }

    const regionInfo = REGION_MAP[regionLabel];
    if (!regionInfo) {
      return res.status(400).json({ error: "Invalid region" });
    }

    // Atomic increment per region
    const updated = await Counter.findOneAndUpdate(
      { regionKey: regionInfo.key },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    const seq = updated.seq;
    const id = `${regionInfo.prefix}${seq}`;

    await Submission.create({
      id,
      seq,
      regionKey: regionInfo.key,
      regionLabel,
      prefix: regionInfo.prefix,
      name,
      phone,
      email
    });

    return res.json({ ok: true });

  } catch (err) {
    console.error("Save error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ================= Start Server =================

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
