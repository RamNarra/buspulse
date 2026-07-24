"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.geohashEncode = geohashEncode;
exports.geohashDecode = geohashDecode;
exports.geohash9 = geohash9;
const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
/**
 * Encode a lat/lng pair into a geohash string.
 * Default precision 5 gives ~5 km × 5 km cells.
 */
function geohashEncode(lat, lng, precision = 5) {
    let idx = 0;
    let bit = 0;
    let even = true;
    let result = "";
    let latMin = -90, latMax = 90;
    let lngMin = -180, lngMax = 180;
    while (result.length < precision) {
        if (even) {
            const mid = (lngMin + lngMax) / 2;
            if (lng >= mid) {
                idx = (idx << 1) | 1;
                lngMin = mid;
            }
            else {
                idx = idx << 1;
                lngMax = mid;
            }
        }
        else {
            const mid = (latMin + latMax) / 2;
            if (lat >= mid) {
                idx = (idx << 1) | 1;
                latMin = mid;
            }
            else {
                idx = idx << 1;
                latMax = mid;
            }
        }
        even = !even;
        if (++bit === 5) {
            result += BASE32[idx];
            idx = 0;
            bit = 0;
        }
    }
    return result;
}
/**
 * Decode a geohash string back to lat/lng plus the half-error of each axis.
 */
function geohashDecode(hash) {
    let even = true;
    let latMin = -90, latMax = 90;
    let lngMin = -180, lngMax = 180;
    for (const char of hash) {
        const ci = BASE32.indexOf(char);
        if (ci < 0)
            break;
        for (let bits = 4; bits >= 0; bits--) {
            const bitN = (ci >> bits) & 1;
            if (even) {
                const mid = (lngMin + lngMax) / 2;
                if (bitN)
                    lngMin = mid;
                else
                    lngMax = mid;
            }
            else {
                const mid = (latMin + latMax) / 2;
                if (bitN)
                    latMin = mid;
                else
                    latMax = mid;
            }
            even = !even;
        }
    }
    return {
        lat: (latMin + latMax) / 2,
        lng: (lngMin + lngMax) / 2,
        latErr: (latMax - latMin) / 2,
        lngErr: (lngMax - lngMin) / 2,
    };
}
/**
 * Returns the center cell plus all 8 surrounding neighbor cells (9 total,
 * deduplicated).
 */
function geohash9(hash) {
    const { lat, lng, latErr, lngErr } = geohashDecode(hash);
    const dLat = latErr * 2;
    const dLng = lngErr * 2;
    const p = hash.length;
    return [
        ...new Set([
            hash,
            geohashEncode(lat + dLat, lng, p), // N
            geohashEncode(lat - dLat, lng, p), // S
            geohashEncode(lat, lng + dLng, p), // E
            geohashEncode(lat, lng - dLng, p), // W
            geohashEncode(lat + dLat, lng + dLng, p), // NE
            geohashEncode(lat - dLat, lng + dLng, p), // SE
            geohashEncode(lat + dLat, lng - dLng, p), // NW
            geohashEncode(lat - dLat, lng - dLng, p), // SW
        ]),
    ];
}
//# sourceMappingURL=geohash.js.map