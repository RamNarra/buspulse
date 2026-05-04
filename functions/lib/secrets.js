"use strict";
// ── Secret Manager wrapper for Cloud Functions ────────────────────────────────
// Mirrors lib/config/secrets.ts but for the functions/ package.
// Usage:  const key = await getSecret("GOOGLE_MAPS_SERVER_KEY");
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
exports.getSecret = getSecret;
let client = null;
let attempted = false;
async function getClient() {
    if (attempted)
        return client;
    attempted = true;
    if (process.env.USE_SECRET_MANAGER !== "true")
        return null;
    try {
        const { SecretManagerServiceClient } = await Promise.resolve().then(() => __importStar(require(
        /* webpackIgnore: true */ "@google-cloud/secret-manager")));
        client = new SecretManagerServiceClient();
        return client;
    }
    catch {
        return null;
    }
}
const cache = new Map();
async function getSecret(name) {
    if (cache.has(name))
        return cache.get(name);
    const sm = await getClient();
    if (sm) {
        const projectId = process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT;
        if (projectId) {
            try {
                const [v] = await sm.accessSecretVersion({
                    name: `projects/${projectId}/secrets/${name}/versions/latest`,
                });
                const val = v.payload.data.toString();
                cache.set(name, val);
                return val;
            }
            catch { /* fall through */ }
        }
    }
    const envVal = process.env[name];
    if (envVal)
        cache.set(name, envVal);
    return envVal;
}
//# sourceMappingURL=secrets.js.map