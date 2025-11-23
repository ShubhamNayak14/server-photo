import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());

const PORT = 5050;
const ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY_COLLECTION;

// Check API key
if (!ACCESS_KEY) {
  console.error("❌ ERROR: UNSPLASH_ACCESS_KEY_COLLECTION missing in .env");
}

// Cache system
let cache = {
  userCollections: null,
  collectionPhotos: {},
  timestamp: 0,
};
const CACHE_TIME = 1000 * 60 * 10; // 10 min

// =========================
// Root Route
// =========================
app.get("/", (req, res) => {
  res.send("✔ DigiLens Unsplash Collection Server Running");
});

// =========================
// 1️⃣ GET ALL COLLECTIONS OF USER "digilens"
// =========================
app.get("/api/digilens/collections", async (req, res) => {
  const now = Date.now();

  if (cache.userCollections && now - cache.timestamp < CACHE_TIME) {
    return res.json(cache.userCollections);
  }

  try {
    const url = `https://api.unsplash.com/users/digilens/collections?per_page=30&client_id=${ACCESS_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    cache.userCollections = data;
    cache.timestamp = now;

    res.json(data);
  } catch (err) {
    console.error("User Collections Error:", err.message);
    res.status(500).json({ error: "Failed to fetch DigiLens collections" });
  }
});

// =========================
// 2️⃣ GET PHOTOS INSIDE A COLLECTION
// =========================
app.get("/api/digilens/collections/:id/photos", async (req, res) => {
  const collectionId = req.params.id;

  const now = Date.now();
  if (
    cache.collectionPhotos[collectionId] &&
    now - cache.collectionPhotos[collectionId].timestamp < CACHE_TIME
  ) {
    return res.json(cache.collectionPhotos[collectionId].photos);
  }

  try {
    const url = `https://api.unsplash.com/collections/${collectionId}/photos?per_page=30&client_id=${ACCESS_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    cache.collectionPhotos[collectionId] = {
      photos: data,
      timestamp: now,
    };

    res.json(data);
  } catch (err) {
    console.error("Collection Photos Error:", err.message);
    res
      .status(500)
      .json({ error: "Failed to fetch photos for the selected collection" });
  }
});

// =========================
// 3️⃣ REGISTER DOWNLOAD
// =========================
app.get("/api/digilens/download/:id", async (req, res) => {
  try {
    const url = `https://api.unsplash.com/photos/${req.params.id}/download?client_id=${ACCESS_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    res.json({ success: true, url: data.url });
  } catch (err) {
    console.error("Download error:", err.message);
    res.status(500).json({ error: "Failed to register download" });
  }
});

app.listen(PORT, () => {
  console.log(`✔ DigiLens Server running on http://localhost:${PORT}`);
});
