"use strict";
// Pure TypeScript geohash — mirrors lib/utils/geohash.ts (functions can't
// import from the Next.js app tree).
Object.defineProperty(exports, "__esModule", { value: true });
exports.geohashEncode = geohashEncode;
exports.geohashDecode = geohashDecode;
const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
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
//# sourceMappingURL=geohash.js.map