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

import * as admin from "firebase-admin";
import { onValueWritten } from "firebase-functions/v2/database";

import type { BusLocation } from "./models";

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
    const { BigQuery } = await import(
      /* webpackIgnore: true */ "@google-cloud/bigquery"
    );
    return new BigQuery({ projectId: PROJECT_ID });
  } catch {
    return null;
  }
}

export const exportBusLocationToBigQuery = onValueWritten(
  {
    ref: "busLocations/{busId}",
    region: "asia-south1",
  },
  async (event) => {
    const busId = event.params.busId;
    const after = event.data.after;

    if (!after.exists()) return; // deletion — skip
    if (!PROJECT_ID) return;     // project not configured

    const loc = after.val() as BusLocation;

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
    } catch (err) {
      // Log but don't throw — a BigQuery failure must never block the main path
      console.error("[BQ] Insert failed:", err);
    }
  },
);
