"use strict";
// ── BigQuery export (Phase 2.5) ───────────────────────────────────────────────
// Fires on every busLocations/{busId} write and appends a row to the BigQuery
// table `buspulse.bus_locations`.
//
// SETUP REQUIRED (cannot be done by code alone):
// 1. Enable BigQuery API in GCP Console for the Firebase project.
// 2. Create dataset: `bq mk --dataset buspulse-493407:buspulse`
// 3. Create table with the schema below:
//    `bq mk --table buspulse-493407:buspulse.bus_locations \
//       busId:STRING,lat:FLOAT,lng:FLOAT,heading:FLOAT,speed:FLOAT, \
//       accuracy:FLOAT,confidence:FLOAT,sourceCount:INTEGER, \
//       routeMatchScore:FLOAT,updatedAt:TIMESTAMP`
// 4. Grant the Functions service account BigQuery Data Editor role.
// 5. Set `BIGQUERY_DATASET=buspulse` in Firebase Functions config or env.
//
// Daily scheduled query for per-stop arrival distribution:
//   SELECT busId, TIMESTAMP_TRUNC(updatedAt, DAY) AS day,
//          AVG(speed) AS avg_speed_ms, STDDEV(speed) AS sd_speed
//   FROM `buspulse-493407.buspulse.bus_locations`
//   GROUP BY 1, 2
//   ORDER BY 2 DESC;
//
// See docs/COSTS.md for estimated BigQuery costs.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportBusLocationToBigQuery = void 0;
const admin = __importStar(require("firebase-admin"));
const database_1 = require("firebase-functions/v2/database");
const PROJECT_ID = process.env.GCLOUD_PROJECT ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "";
const DATASET = process.env.BIGQUERY_DATASET ?? "buspulse";
const TABLE = "bus_locations";
/**
 * Lazy-loaded BigQuery client. The `@google-cloud/bigquery` package is an
 * optional peer dependency — if it is not installed (e.g. during local dev),
 * the function is a no-op.
 */
async function getBigQueryClient() {
    try {
        // Dynamic import to avoid hard failure when package is absent
        const { BigQuery } = await Promise.resolve().then(() => __importStar(require(
        /* webpackIgnore: true */ "@google-cloud/bigquery")));
        return new BigQuery({ projectId: PROJECT_ID });
    }
    catch {
        return null;
    }
}
exports.exportBusLocationToBigQuery = (0, database_1.onValueWritten)({
    ref: "busLocations/{busId}",
    region: "asia-southeast1",
}, async (event) => {
    const busId = event.params.busId;
    const after = event.data.after;
    if (!after.exists())
        return; // deletion — skip
    if (!PROJECT_ID)
        return; // project not configured
    const loc = after.val();
    const bq = await getBigQueryClient();
    if (!bq) {
        // BigQuery package not installed — log and skip
        console.info("[BQ] @google-cloud/bigquery not installed; skipping export.");
        return;
    }
    const row = {
        busId,
        lat: loc.lat,
        lng: loc.lng,
        heading: loc.heading ?? null,
        speed: loc.speed ?? null,
        accuracy: loc.accuracy,
        confidence: loc.confidence,
        sourceCount: loc.sourceCount,
        routeMatchScore: loc.routeMatchScore,
        // BigQuery TIMESTAMP from Unix ms
        updatedAt: admin.firestore.Timestamp.fromMillis(loc.updatedAt).toDate(),
    };
    try {
        await bq.dataset(DATASET).table(TABLE).insert([row]);
    }
    catch (err) {
        // Log but don't throw — a BigQuery failure must never block the main path
        console.error("[BQ] Insert failed:", err);
    }
});
//# sourceMappingURL=bigquery-export.js.map