import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import type { ConnectConfig } from "ssh2";

const positiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const DEEPHPI_CONFIG = {
  jobDir: process.env.PREDICTION_JOB_DIR || path.join(os.tmpdir(), "deephpi-jobs"),
  retentionMs: positiveInteger(process.env.PREDICTION_JOB_RETENTION_MS, 30 * 24 * 60 * 60 * 1000),
  maxActiveJobs: positiveInteger(process.env.PREDICTION_MAX_ACTIVE_JOBS, 10),
  maxActiveJobsPerClient: positiveInteger(process.env.PREDICTION_MAX_ACTIVE_JOBS_PER_CLIENT, 2),
  sshKeepaliveIntervalMs: positiveInteger(process.env.SSH_KEEPALIVE_INTERVAL_MS, 15_000),
  sshKeepaliveCountMax: positiveInteger(process.env.SSH_KEEPALIVE_COUNT_MAX, 4),
  cluster: {
    host: process.env.BIOCLUSTER_HOST || "",
    port: positiveInteger(process.env.BIOCLUSTER_PORT, 22),
    username: process.env.BIOCLUSTER_USER || "",
    privateKeyPath: process.env.BIOCLUSTER_SSH_KEY_PATH || "",
    hostKeySha256: process.env.BIOCLUSTER_HOST_KEY_SHA256 || "",
    remoteScript: process.env.BIOCLUSTER_REMOTE_SCRIPT || "",
    remoteTmpDir: process.env.BIOCLUSTER_REMOTE_TMP_DIR || "",
  },
};

export function getSSHAuthOptions(): ConnectConfig {
  const cluster = DEEPHPI_CONFIG.cluster;
  if (!cluster.host || !cluster.username) throw new Error("BIOCLUSTER_HOST and BIOCLUSTER_USER must be configured.");
  if (!cluster.hostKeySha256) throw new Error("BIOCLUSTER_HOST_KEY_SHA256 must pin the verified cluster SSH host key.");
  if (!cluster.remoteScript || !cluster.remoteTmpDir) throw new Error("BIOCLUSTER_REMOTE_SCRIPT and BIOCLUSTER_REMOTE_TMP_DIR must be configured.");
  if (!cluster.privateKeyPath || !fs.existsSync(/* turbopackIgnore: true */ cluster.privateKeyPath)) throw new Error("BIOCLUSTER_SSH_KEY_PATH must reference a readable dedicated SSH key.");

  const expected = cluster.hostKeySha256.replace(/^SHA256:/, "").replace(/=+$/, "");
  return {
    host: cluster.host,
    port: cluster.port,
    username: cluster.username,
    privateKey: fs.readFileSync(/* turbopackIgnore: true */ cluster.privateKeyPath),
    readyTimeout: 20_000,
    keepaliveInterval: DEEPHPI_CONFIG.sshKeepaliveIntervalMs,
    keepaliveCountMax: DEEPHPI_CONFIG.sshKeepaliveCountMax,
    hostVerifier: (key: Buffer) => {
      const actual = crypto.createHash("sha256").update(key).digest("base64").replace(/=+$/, "");
      const left = Buffer.from(actual);
      const right = Buffer.from(expected);
      return left.length === right.length && crypto.timingSafeEqual(left, right);
    },
  };
}
