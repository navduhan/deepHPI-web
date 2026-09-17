import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { DEEPHPI_CONFIG } from "./config";
import { cleanupRemoteJob, inspectClusterJob, submitClusterJob } from "./cluster";
import { sendJobNotification, type NotificationEvent } from "./notifications";

export type JobStatus = "queued" | "running" | "completed" | "failed";
export type JobRecord = {
  jobId: string;
  status: JobStatus;
  message: string;
  createdAt: string;
  updatedAt: string;
  model: string;
  feature: string;
  hostInputType: string;
  pathogenInputType: string;
  hostSequenceCount: number;
  pathogenSequenceCount: number;
  pairwiseCount: number;
  email: string;
  tokenHash: string;
  ownerHash: string;
  clusterJobId: string;
  remoteDir: string;
  stage?: string;
  summary?: Record<string, number>;
  results?: unknown;
  network?: unknown;
  error?: string;
  notifications?: NotificationEvent[];
};

const validJobId = /^deephpi_[a-f0-9]{32}$/;
const jobDirectory = (jobId: string) => path.join(DEEPHPI_CONFIG.jobDir, jobId);
const recordPath = (jobId: string) => path.join(jobDirectory(jobId), "job.json");

async function writeRecord(record: JobRecord) {
  const target = recordPath(record.jobId);
  const temporary = `${target}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(record), { encoding: "utf8", mode: 0o600 });
  await fs.rename(temporary, target);
}

async function updateRecord(record: JobRecord, changes: Partial<JobRecord>) {
  const updated = { ...record, ...changes, updatedAt: new Date().toISOString() };
  await writeRecord(updated);
  return updated;
}

export function hashJobToken(token: string) { return crypto.createHash("sha256").update(token).digest("hex"); }
export function verifyJobToken(record: JobRecord, token: string) {
  if (!token) return false;
  const actual = Buffer.from(hashJobToken(token));
  const expected = Buffer.from(record.tokenHash);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

async function allRecords() {
  await fs.mkdir(DEEPHPI_CONFIG.jobDir, { recursive: true, mode: 0o700 });
  const entries = await fs.readdir(DEEPHPI_CONFIG.jobDir, { withFileTypes: true });
  const records: JobRecord[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !validJobId.test(entry.name)) continue;
    try {
      const record = JSON.parse(await fs.readFile(recordPath(entry.name), "utf8")) as JobRecord;
      const age = Date.now() - new Date(record.updatedAt).getTime();
      if ((record.status === "completed" || record.status === "failed") && age > DEEPHPI_CONFIG.retentionMs) {
        await fs.rm(jobDirectory(entry.name), { recursive: true, force: true });
      } else records.push(record);
    } catch {}
  }
  return records;
}

export class JobCapacityError extends Error { readonly status = 429; }

export async function createPredictionJob(input: Omit<JobRecord, "clusterJobId" | "remoteDir" | "status" | "message" | "createdAt" | "updatedAt"> & { hostInput: string; pathogenInput: string; pairwiseInput: string }) {
  const records = await allRecords();
  const active = records.filter((record) => record.status === "queued" || record.status === "running");
  if (active.length >= DEEPHPI_CONFIG.maxActiveJobs) throw new JobCapacityError("The prediction service is currently at capacity.");
  if (active.filter((record) => record.ownerHash === input.ownerHash).length >= DEEPHPI_CONFIG.maxActiveJobsPerClient) throw new JobCapacityError("You already have the maximum number of active prediction jobs.");
  await fs.mkdir(jobDirectory(input.jobId), { recursive: false, mode: 0o700 });
  try {
    const submitted = await submitClusterJob(input);
    const now = new Date().toISOString();
    const record: JobRecord = {
      jobId: input.jobId, status: "queued", message: "Job accepted by the HPC scheduler.", createdAt: now, updatedAt: now,
      model: input.model, feature: input.feature, hostInputType: input.hostInputType, pathogenInputType: input.pathogenInputType,
      hostSequenceCount: input.hostSequenceCount, pathogenSequenceCount: input.pathogenSequenceCount, pairwiseCount: input.pairwiseCount,
      email: input.email, tokenHash: input.tokenHash, ownerHash: input.ownerHash,
      clusterJobId: submitted.clusterJobId, remoteDir: submitted.remoteDir,
    };
    await writeRecord(record);
    if (record.email) {
      try {
        if (await sendJobNotification(record, "submitted")) return updateRecord(record, { notifications: ["submitted"] });
      } catch (error) { console.warn("DeepHPI submission email failed:", error); }
    }
    return record;
  } catch (error) {
    await fs.rm(jobDirectory(input.jobId), { recursive: true, force: true });
    throw error;
  }
}

export async function readPredictionJob(jobId: string, refresh = true) {
  if (!validJobId.test(jobId)) throw new Error("Invalid job identifier.");
  let record = JSON.parse(await fs.readFile(recordPath(jobId), "utf8")) as JobRecord;
  if (!refresh || record.status === "completed" || record.status === "failed") return record;
  const state = await inspectClusterJob(record.clusterJobId, record.remoteDir);
  if (state.status === "completed") {
    record = await updateRecord(record, {
      status: "completed", message: "Prediction completed successfully.", stage: "Completed",
      results: state.results, network: state.network, summary: state.workerStatus.summary,
    });
    if (record.email && !record.notifications?.includes("completed")) {
      try {
        if (await sendJobNotification(record, "completed")) record = await updateRecord(record, { notifications: [...(record.notifications || []), "completed"] });
      } catch (error) { console.warn("DeepHPI completion email failed:", error); }
    }
    void cleanupRemoteJob(record.remoteDir).catch((error) => console.warn("DeepHPI remote cleanup failed:", error));
  } else if (state.status === "failed") {
    record = await updateRecord(record, { status: "failed", message: "Prediction failed.", error: state.error });
    if (record.email && !record.notifications?.includes("failed")) {
      try {
        if (await sendJobNotification(record, "failed")) record = await updateRecord(record, { notifications: [...(record.notifications || []), "failed"] });
      } catch (error) { console.warn("DeepHPI failure email failed:", error); }
    }
  }
  else record = await updateRecord(record, { status: state.status, message: state.status === "queued" ? "Waiting in the HPC queue." : "Prediction is running on HPC.", stage: state.state });
  return record;
}
