// import express from "express";
// import fetch from "node-fetch";
// import cors from "cors";
// import dotenv from "dotenv";

// dotenv.config();

// const app = express();
// app.use(cors());

// // Debug log for API key
// console.log("Unsplash KEY:", process.env.UNSPLASH_ACCESS_KEY ? "Loaded" : "MISSING");

// // HOME ROUTE
// app.get("/", (req, res) => {
//   res.send("Unsplash API Server is running...");
// });

// // --------------------------------------------------
// // GET DIGILENS USER PHOTOS  ✔ FIXED
// // --------------------------------------------------
// app.get("/api/photos", async (req, res) => {
//   try {
//     const url = `https://api.unsplash.com/users/digilens/photos?per_page=80&client_id=${process.env.UNSPLASH_ACCESS_KEY}`;

//     console.log("Fetching:", url);

//     const r = await fetch(url);
//     const data = await r.json();

//     console.log("Unsplash Photo Response:", data);

//     // Handle invalid key or errors
//     if (data.errors) {
//       return res.status(400).json({
//         success: false,
//         message: "Unsplash API Error",
//         errors: data.errors
//       });
//     }

//     // Return photos in consistent format
//     res.json({ results: data });

//   } catch (err) {
//     console.error("Server Error:", err);
//     res.status(500).json({ error: "Failed to fetch photos" });
//   }
// });

// // --------------------------------------------------
// // GET DIGILENS USER COLLECTIONS  ✔ FIXED
// // --------------------------------------------------
// app.get("/api/collections", async (req, res) => {
//   try {
//     const url = `https://api.unsplash.com/users/digilens/collections?per_page=10&client_id=${process.env.UNSPLASH_ACCESS_KEY}`;

//     console.log("Fetching:", url);

//     const r = await fetch(url);
//     const data = await r.json();

//     console.log("Unsplash Collection Response:", data);

//     // Handle invalid key or errors
//     if (data.errors) {
//       return res.status(400).json({
//         success: false,
//         message: "Unsplash API Error",
//         errors: data.errors
//       });
//     }

//     res.json({ results: data });

//   } catch (err) {
//     console.error("Server Error:", err);
//     res.status(500).json({ error: "Failed to fetch collections" });
//   }
// });

// // --------------------------------------------------
// // START SERVER
// // --------------------------------------------------
// app.listen(5000, () => {
//   console.log("==================================");
//   console.log("Server running on http://localhost:5000");
//   console.log("Photos API → http://localhost:5000/api/photos");
//   console.log("Collections API → http://localhost:5000/api/collections");
//   console.log("==================================");
// });

import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());

// ===============================================================
// 1️⃣ RATE LIMITING (Avoid too many calls)
// ===============================================================
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1500; // 1.5 sec between calls

function enforceRateLimit(req, res, next) {
  const now = Date.now();
  if (now - lastRequestTime < MIN_REQUEST_INTERVAL) {
    return res.status(429).json({
      success: false,
      message: "Too many requests. Wait a moment."
    });
  }
  lastRequestTime = now;
  next();
}

app.use(enforceRateLimit);

// ===============================================================
// 2️⃣ ONE–HOUR CACHE (Required by Unsplash Guidelines)
// ===============================================================
let photoCache = null;
let photoCacheTime = 0;

let collectionCache = null;
let collectionCacheTime = 0;

const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

// ===============================================================
// HOME ROUTE
// ===============================================================
app.get("/", (req, res) => {
  res.send("Unsplash API Server (Compliant Version) is running...");
});

// ===============================================================
// 3️⃣ GET DIGILENS PHOTOS (with caching + attribution)
// ===============================================================
app.get("/api/photos", async (req, res) => {
  try {
    const now = Date.now();

    if (photoCache && now - photoCacheTime < CACHE_DURATION) {
      console.log("Serving photos from CACHE");
      return res.json(photoCache);
    }

    // Step 1 → Fetch the list of photos
    const listURL = `https://api.unsplash.com/users/digilens/photos?per_page=50&client_id=${process.env.UNSPLASH_ACCESS_KEY}`;
    const listRes = await fetch(listURL);
    const photoList = await listRes.json();

    if (photoList.errors) {
      return res.status(400).json({
        success: false,
        message: "Unsplash API Error",
        errors: photoList.errors
      });
    }

    // Step 2 → Fetch statistics (downloads + views) for each photo
    const detailedPhotos = await Promise.all(
      photoList.map(async (photo) => {
        const statsURL = `https://api.unsplash.com/photos/${photo.id}/statistics?client_id=${process.env.UNSPLASH_ACCESS_KEY}`;
        const statsRes = await fetch(statsURL);
        const stats = await statsRes.json();

        return {
          ...photo,
          total_views: stats.views?.total || 0,
          total_downloads: stats.downloads?.total || 0,

          attribution: `Photo by ${photo.user.name} on Unsplash`,
          credit_url: `https://unsplash.com/@${photo.user.username}?utm_source=your_app_name&utm_medium=referral`
        };
      })
    );

    // Cache result for 1 hour
    photoCache = { results: detailedPhotos };
    photoCacheTime = now;

    res.json(photoCache);

  } catch (err) {
    console.error("Photo Fetch Error:", err);
    res.status(500).json({ error: "Failed to fetch photos" });
  }
});



// ===============================================================
// START SERVER
// ===============================================================
app.listen(5000, () => {
  console.log("=====================================================");
  console.log("Compliant Unsplash Server running on http://localhost:5000");
  console.log("Photos → http://localhost:5000/api/photos");
  console.log("=====================================================");
});

