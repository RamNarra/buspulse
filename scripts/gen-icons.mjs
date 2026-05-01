import sharp from "sharp";
import { writeFile } from "fs/promises";

function svgIcon(size) {
  const r = (n) => Math.round(n);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r(size * 0.18)}" fill="#6366f1"/>
  <rect x="${r(size * 0.14)}" y="${r(size * 0.28)}" width="${r(size * 0.72)}" height="${r(size * 0.38)}" rx="${r(size * 0.06)}" fill="white"/>
  <rect x="${r(size * 0.20)}" y="${r(size * 0.34)}" width="${r(size * 0.16)}" height="${r(size * 0.14)}" rx="${r(size * 0.03)}" fill="#6366f1"/>
  <rect x="${r(size * 0.42)}" y="${r(size * 0.34)}" width="${r(size * 0.16)}" height="${r(size * 0.14)}" rx="${r(size * 0.03)}" fill="#6366f1"/>
  <rect x="${r(size * 0.64)}" y="${r(size * 0.34)}" width="${r(size * 0.12)}" height="${r(size * 0.14)}" rx="${r(size * 0.03)}" fill="#6366f1"/>
  <circle cx="${r(size * 0.28)}" cy="${r(size * 0.70)}" r="${r(size * 0.09)}" fill="white"/>
  <circle cx="${r(size * 0.72)}" cy="${r(size * 0.70)}" r="${r(size * 0.09)}" fill="white"/>
  <polyline
    points="${r(size*.16)},${r(size*.84)} ${r(size*.28)},${r(size*.84)} ${r(size*.36)},${r(size*.73)} ${r(size*.44)},${r(size*.93)} ${r(size*.52)},${r(size*.76)} ${r(size*.60)},${r(size*.84)} ${r(size*.84)},${r(size*.84)}"
    fill="none" stroke="#a5b4fc" stroke-width="${r(size * 0.033)}" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
}

for (const size of [192, 512]) {
  const buf = await sharp(Buffer.from(svgIcon(size))).png().toBuffer();
  await writeFile(`public/icon-${size}.png`, buf);
  console.log(`public/icon-${size}.png  (${buf.length} bytes)`);
}
