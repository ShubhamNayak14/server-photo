// server.js
import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());

// ROOT
app.get("/", (req, res) => {
  res.send("<h1>Server Running</h1><p>Use /api/photos</p>");
});

// Prevent favicon noise
app.get("/favicon.ico", (req, res) => res.status(204).end());

// -----------------------------
// CACHE (1 hour)
// -----------------------------
const cache = new Map();
const CACHE_DURATION = 60 * 60 * 1000;

// -----------------------------
// Helper: Delay
// -----------------------------
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// -----------------------------
// Main Route – Paginated Photos
// -----------------------------
app.get("/api/photos", async (req, res) => {
  try {
    const page = req.query.page || 1;
    const per_page = 20;

    const cacheKey = `page_${page}_${per_page}`;
    const now = Date.now();

    // Serve from cache if fresh
    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey);
      if (now - cached.timestamp < CACHE_DURATION) {
        console.log(`Serving Page ${page} from CACHE`);
        return res.json(cached.data);
      }
    }

    // 1. Fetch photo list
    const listURL = `https://api.unsplash.com/users/digilens/photos?page=${page}&per_page=${per_page}&client_id=${process.env.UNSPLASH_ACCESS_KEY}`;

    const listRes = await fetch(listURL);
    if (listRes.status === 429 || listRes.status === 403) {
      return res.status(429).json({ error: "Unsplash rate limit hit." });
    }

    const photoList = await listRes.json();
    if (!Array.isArray(photoList)) {
      return res.status(400).json({ error: "Bad response from Unsplash" });
    }

    console.log(`Page ${page}: ${photoList.length} photos found`);

    // 2. Fetch statistics for each photo — spaced by 50ms
    const detailedPhotos = await Promise.all(
      photoList.map(async (photo, idx) => {
        await delay(50); // 50ms spacing to avoid bursts

        const statsURL = `https://api.unsplash.com/photos/${photo.id}/statistics?client_id=${process.env.UNSPLASH_ACCESS_KEY}`;
        const statsRes = await fetch(statsURL);
        const stats = await statsRes.json();

        return {
          id: photo.id,
          urls: photo.urls,
          user: photo.user,
          total_likes: photo.likes,
          total_views: stats.views?.total || 0,
          total_downloads: stats.downloads?.total || 0,
          attribution: `Photo by ${photo.user.name} on Unsplash`,
          credit_url: photo.user.links.html,
        };
      })
    );

    // Save to cache
    cache.set(cacheKey, {
      timestamp: now,
      data: detailedPhotos,
    });

    res.json(detailedPhotos);
  } catch (err) {
    console.error("PHOTO FETCH ERROR:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

// START SERVER
app.listen(5000, () => console.log("Server running on http://localhost:5000"));











