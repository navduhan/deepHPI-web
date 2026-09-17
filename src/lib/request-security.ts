import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

export class RequestSecurityError extends Error {
  constructor(message: string, readonly status: number, readonly retryAfter?: number) {
    super(message);
    this.name = "RequestSecurityError";
  }
}

const positiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const REQUEST_LIMITS = {
  bodyBytes: positiveInteger(process.env.MAX_REQUEST_BODY_BYTES, 4 * 1024 * 1024),
  accessionCount: positiveInteger(process.env.MAX_ACCESSION_COUNT, 100),
  accessionLength: positiveInteger(process.env.MAX_ACCESSION_LENGTH, 64),
  sequencesPerSide: positiveInteger(process.env.PREDICTION_MAX_SEQUENCES_PER_SIDE, 500),
  sequenceLength: positiveInteger(process.env.PREDICTION_MAX_SEQUENCE_LENGTH, 50_000),
  totalResidues: positiveInteger(process.env.PREDICTION_MAX_RESIDUES, 2_000_000),
  candidatePairs: positiveInteger(process.env.PREDICTION_MAX_CANDIDATE_PAIRS, 10_000),
};

type RateWindow = { count: number; resetAt: number };
const rateWindows = new Map<string, RateWindow>();

export function clientIp(req: NextRequest) {
  return req.headers.get("x-real-ip")?.trim() || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return;
  const expectedHost = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (!expectedHost) throw new RequestSecurityError("Request origin could not be verified.", 403);
  try {
    if (new URL(origin).host !== expectedHost) throw new RequestSecurityError("Cross-origin requests are not allowed.", 403);
  } catch (error) {
    if (error instanceof RequestSecurityError) throw error;
    throw new RequestSecurityError("Invalid request origin.", 403);
  }
}

export function enforceRateLimit(scope: string, identity: string, limit: number, windowMs: number) {
  const now = Date.now();
  const key = `${scope}:${identity}`;
  const current = rateWindows.get(key);
  if (!current || current.resetAt <= now) rateWindows.set(key, { count: 1, resetAt: now + windowMs });
  else if (current.count >= limit) throw new RequestSecurityError("Too many requests. Please try again later.", 429, Math.max(1, Math.ceil((current.resetAt - now) / 1000)));
  else current.count += 1;
  if (rateWindows.size > 10_000) for (const [entryKey, value] of rateWindows) if (value.resetAt <= now) rateWindows.delete(entryKey);
}

export async function readJsonBody<T>(req: NextRequest): Promise<T> {
  const declaredLength = Number.parseInt(req.headers.get("content-length") || "0", 10);
  if (declaredLength > REQUEST_LIMITS.bodyBytes) throw new RequestSecurityError("Request body is too large.", 413);
  const raw = await req.text();
  if (Buffer.byteLength(raw, "utf8") > REQUEST_LIMITS.bodyBytes) throw new RequestSecurityError("Request body is too large.", 413);
  try { return JSON.parse(raw) as T; } catch { throw new RequestSecurityError("Request body must be valid JSON.", 400); }
}

export type FastaType = "protein" | "nucleotide";
export function validateFasta(text: string, label: string, expectedType: FastaType) {
  if (!text.trim()) throw new RequestSecurityError(`${label} FASTA input is required.`, 400);
  const alphabet = expectedType === "protein" ? /^[ACDEFGHIKLMNPQRSTVWYBXZJUO*-]+$/ : /^[ACGTUNRYKMSWBDHV-]+$/;
  let count = 0;
  let currentLength = -1;
  let residues = 0;
  const ids = new Set<string>();
  for (const rawLine of text.trim().split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith(">")) {
      if (currentLength === 0) throw new RequestSecurityError(`${label} FASTA contains an empty sequence.`, 400);
      const id = line.slice(1).trim().split(/\s+/)[0];
      if (!id || !/^[A-Za-z0-9_.:|+-]+$/.test(id)) throw new RequestSecurityError(`${label} FASTA contains an invalid sequence identifier.`, 400);
      if (ids.has(id)) throw new RequestSecurityError(`${label} FASTA contains a duplicate identifier: ${id}.`, 400);
      ids.add(id);
      count += 1;
      if (count > REQUEST_LIMITS.sequencesPerSide) throw new RequestSecurityError(`${label} FASTA exceeds ${REQUEST_LIMITS.sequencesPerSide} sequences.`, 400);
      currentLength = 0;
      continue;
    }
    if (currentLength < 0) throw new RequestSecurityError(`${label} FASTA must begin with a header.`, 400);
    const normalized = line.replace(/\s+/g, "").toUpperCase();
    if (!alphabet.test(normalized)) throw new RequestSecurityError(`${label} FASTA contains characters outside the selected ${expectedType} alphabet.`, 400);
    currentLength += normalized.length;
    residues += normalized.length;
    if (currentLength > REQUEST_LIMITS.sequenceLength) throw new RequestSecurityError(`${label} contains a sequence longer than ${REQUEST_LIMITS.sequenceLength} residues.`, 400);
    if (residues > REQUEST_LIMITS.totalResidues) throw new RequestSecurityError(`${label} FASTA exceeds the total residue limit.`, 400);
  }
  if (currentLength <= 0) throw new RequestSecurityError(`${label} FASTA ends with an empty record.`, 400);
  return { count, residues, ids };
}

export function validatePairwise(text: string, hostIds: Set<string>, pathogenIds: Set<string>) {
  if (!text.trim()) return 0;
  let count = 0;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const columns = line.split("\t");
    if (columns.length !== 2 || !hostIds.has(columns[0]) || !pathogenIds.has(columns[1])) {
      throw new RequestSecurityError("Each pairwise row must contain one submitted host ID and one submitted pathogen ID separated by a tab.", 400);
    }
    count += 1;
    if (count > REQUEST_LIMITS.candidatePairs) throw new RequestSecurityError("The pairwise list exceeds the candidate-pair limit.", 400);
  }
  return count;
}

export function parseAccessions(value: unknown) {
  if (typeof value !== "string") throw new RequestSecurityError("Accession IDs must be provided as text.", 400);
  const accessions = value.split(/[\s,;]+/).map((item) => item.trim()).filter(Boolean);
  if (!accessions.length) throw new RequestSecurityError("No accession IDs were provided.", 400);
  if (accessions.length > REQUEST_LIMITS.accessionCount) throw new RequestSecurityError(`A maximum of ${REQUEST_LIMITS.accessionCount} accessions can be fetched at once.`, 400);
  if (accessions.some((item) => item.length > REQUEST_LIMITS.accessionLength || !/^[A-Za-z0-9_.:-]+$/.test(item))) throw new RequestSecurityError("One or more accession IDs contain invalid characters.", 400);
  return accessions;
}

export async function verifyTurnstile(token: unknown, ip: string) {
  if (process.env.TURNSTILE_REQUIRED !== "true") return;
  if (typeof token !== "string" || !token) throw new RequestSecurityError("Please complete the anti-bot verification.", 403);
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) throw new RequestSecurityError("Anti-bot verification is not configured.", 503);
  const body = new URLSearchParams({ secret, response: token });
  if (ip !== "unknown") body.set("remoteip", ip);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, signal: AbortSignal.timeout(8_000), cache: "no-store" });
  const result = await response.json() as { success?: boolean };
  if (!response.ok || !result.success) throw new RequestSecurityError("Anti-bot verification failed.", 403);
}

export function ownerHash(ip: string) {
  const secret = process.env.JOB_OWNER_HMAC_SECRET || "development-only-owner-secret";
  return crypto.createHmac("sha256", secret).update(ip).digest("hex");
}

export function bearerToken(req: NextRequest) {
  const token = req.headers.get("x-deephpi-job-token")?.trim();
  if (token) return token;
  const authorization = req.headers.get("authorization") || "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
}

export function securityErrorResponse(error: unknown) {
  if (!(error instanceof RequestSecurityError)) return null;
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (error.retryAfter) headers["Retry-After"] = String(error.retryAfter);
  return NextResponse.json({ error: error.message }, { status: error.status, headers });
}
