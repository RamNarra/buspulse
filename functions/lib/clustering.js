"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateAdaptiveEpsilon = calculateAdaptiveEpsilon;
exports.findLargestSpatialCluster = findLargestSpatialCluster;
const geo_1 = require("./geo");
/**
 * Calculates adaptive clustering radius (epsilon) based on average candidate GPS accuracy.
 * Expands radius under degraded urban signal conditions and tightens under clear sky.
 */
function calculateAdaptiveEpsilon(candidates, baseEpsilon = 30) {
    if (!candidates || candidates.length === 0)
        return baseEpsilon;
    const accuracies = candidates
        .map((c) => c.accuracy)
        .filter((acc) => typeof acc === 'number' && acc > 0);
    if (accuracies.length === 0)
        return baseEpsilon;
    const avgAccuracy = accuracies.reduce((sum, a) => sum + a, 0) / accuracies.length;
    return Math.max(baseEpsilon, Math.min(120, avgAccuracy * 2));
}
/**
 * DBSCAN Spatial Clustering algorithm tailored for vehicle sensor candidate fixes.
 * Groups co-located fixes within maxDistanceMeters (or adaptive epsilon) and identifies the primary cluster,
 * filtering out isolated GPS spoofing attempts or stray devices.
 */
function findLargestSpatialCluster(candidates, maxDistanceMeters, minPts = 1) {
    if (!candidates || candidates.length === 0) {
        return { primaryCluster: [], outliers: [] };
    }
    const effectiveEpsilon = typeof maxDistanceMeters === 'number' && maxDistanceMeters > 0
        ? maxDistanceMeters
        : calculateAdaptiveEpsilon(candidates);
    if (candidates.length === 1) {
        return { primaryCluster: candidates, outliers: [] };
    }
    const visited = new Set();
    const clusters = [];
    for (let i = 0; i < candidates.length; i++) {
        if (visited.has(i))
            continue;
        visited.add(i);
        const neighbors = getNeighbors(candidates, i, effectiveEpsilon);
        if (neighbors.length >= minPts) {
            const cluster = [candidates[i]];
            const queue = [...neighbors];
            for (let j = 0; j < queue.length; j++) {
                const neighborIdx = queue[j];
                if (!visited.has(neighborIdx)) {
                    visited.add(neighborIdx);
                    const subNeighbors = getNeighbors(candidates, neighborIdx, effectiveEpsilon);
                    if (subNeighbors.length >= minPts) {
                        queue.push(...subNeighbors.filter((n) => !queue.includes(n)));
                    }
                }
                if (!cluster.includes(candidates[neighborIdx])) {
                    cluster.push(candidates[neighborIdx]);
                }
            }
            clusters.push(cluster);
        }
    }
    if (clusters.length === 0) {
        return { primaryCluster: candidates, outliers: [] };
    }
    // Find the largest cluster by count
    clusters.sort((a, b) => b.length - a.length);
    const primaryCluster = clusters[0];
    const primarySet = new Set(primaryCluster);
    const outliers = candidates.filter((c) => !primarySet.has(c));
    return { primaryCluster, outliers };
}
function getNeighbors(candidates, targetIdx, maxDistanceMeters) {
    const neighbors = [];
    const target = candidates[targetIdx];
    for (let i = 0; i < candidates.length; i++) {
        if (i === targetIdx)
            continue;
        const dist = (0, geo_1.haversineMeters)(target.lat, target.lng, candidates[i].lat, candidates[i].lng);
        if (dist <= maxDistanceMeters) {
            neighbors.push(i);
        }
    }
    return neighbors;
}
//# sourceMappingURL=clustering.js.map