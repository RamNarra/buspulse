"use strict";
/**
 * 2D Constant Velocity Kalman Filter for Bus Location Tracking.
 * Smooths GPS noise, predicts position during brief signal loss,
 * and maintains steady velocity estimation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createKalmanFilter = createKalmanFilter;
exports.predictKalmanState = predictKalmanState;
exports.updateKalmanState = updateKalmanState;
function createKalmanFilter(initialLat, initialLng, initialTs = Date.now()) {
    return {
        lat: initialLat,
        lng: initialLng,
        vLat: 0,
        vLng: 0,
        variance: 100, // initial high uncertainty
        lastTs: initialTs,
    };
}
/**
 * Predicts new state after dtSeconds elapsed without measurement.
 */
function predictKalmanState(state, now = Date.now(), processNoise = 0.5) {
    const dtSec = Math.max(0, (now - state.lastTs) / 1000);
    if (dtSec === 0)
        return state;
    return {
        lat: state.lat + state.vLat * dtSec,
        lng: state.lng + state.vLng * dtSec,
        vLat: state.vLat,
        vLng: state.vLng,
        variance: state.variance + processNoise * dtSec,
        lastTs: now,
    };
}
/**
 * Updates Kalman filter state with a new GPS measurement fix.
 */
function updateKalmanState(state, measLat, measLng, accuracyMeters = 15, now = Date.now()) {
    const predicted = predictKalmanState(state, now);
    const dtSec = Math.max(0.001, (now - state.lastTs) / 1000);
    // Measurement noise variance derived from GPS accuracy (in approximate degrees squared)
    const measVariance = Math.max(1, (accuracyMeters / 111000) ** 2 * 1e10);
    // Kalman Gain K
    const K = predicted.variance / (predicted.variance + measVariance);
    // Residual (Innovation)
    const resLat = measLat - predicted.lat;
    const resLng = measLng - predicted.lng;
    // Updated state estimate
    const updatedLat = predicted.lat + K * resLat;
    const updatedLng = predicted.lng + K * resLng;
    // Velocity update with exponential damping
    const instVLat = resLat / dtSec;
    const instVLng = resLng / dtSec;
    const updatedVLat = predicted.vLat * (1 - K) + instVLat * K;
    const updatedVLng = predicted.vLng * (1 - K) + instVLng * K;
    return {
        lat: updatedLat,
        lng: updatedLng,
        vLat: updatedVLat,
        vLng: updatedVLng,
        variance: (1 - K) * predicted.variance,
        lastTs: now,
    };
}
//# sourceMappingURL=kalman.js.map