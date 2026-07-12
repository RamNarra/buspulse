/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");

const copies = [
  // Geo
  { src: "lib/shared/geo.ts", dest: "lib/utils/geo.ts" },
  { src: "lib/shared/geo.ts", dest: "functions/src/geo.ts" },
  // Geohash
  { src: "lib/shared/geohash.ts", dest: "lib/utils/geohash.ts" },
  { src: "lib/shared/geohash.ts", dest: "functions/src/geohash.ts" },
  // Scoring
  { src: "lib/shared/scoring.ts", dest: "lib/live/scoring.ts" },
  { src: "lib/shared/scoring.ts", dest: "functions/src/scoring.ts" },
  // Anomaly
  { src: "lib/shared/anomaly.ts", dest: "lib/server/anomaly.ts" },
  { src: "lib/shared/anomaly.ts", dest: "functions/src/anomaly-math.ts" },
];

console.log("[BusPulse] Synchronizing shared logic files...");

for (const copy of copies) {
  const srcPath = path.join(rootDir, copy.src);
  const destPath = path.join(rootDir, copy.dest);

  try {
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(srcPath, destPath);
    console.log(`✓ Copied ${copy.src} -> ${copy.dest}`);
  } catch (err) {
    console.error(`✗ Failed to copy ${copy.src} -> ${copy.dest}:`, err.message);
    process.exit(1);
  }
}

console.log("[BusPulse] Shared logic synchronization completed successfully.");
