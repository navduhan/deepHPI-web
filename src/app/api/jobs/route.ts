import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createPredictionJob, hashJobToken, JobCapacityError, type JobRecord } from "@/lib/prediction-jobs";
import { assertSameOrigin, clientIp, enforceRateLimit, ownerHash, readJsonBody, REQUEST_LIMITS, RequestSecurityError, securityErrorResponse, validateFasta, validatePairwise, verifyTurnstile, type FastaType } from "@/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const publicJob = (job: JobRecord) => ({
  jobId: job.jobId, status: job.status, message: job.message, createdAt: job.createdAt, updatedAt: job.updatedAt,
  model: job.model, feature: job.feature, hostInputType: job.hostInputType, pathogenInputType: job.pathogenInputType,
  hostSequenceCount: job.hostSequenceCount, pathogenSequenceCount: job.pathogenSequenceCount, pairwiseCount: job.pairwiseCount,
  stage: job.stage, summary: job.summary, error: job.error,
});

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const ip = clientIp(req);
    enforceRateLimit("job-submit", ip, 3, 10 * 60 * 1000);
    const body = await readJsonBody<Record<string, unknown>>(req);
    const hostInput = typeof body.hostInput === "string" ? body.hostInput.trim() : "";
    const pathogenInput = typeof body.pathogenInput === "string" ? body.pathogenInput.trim() : "";
    const pairwiseInput = typeof body.pairwiseInput === "string" ? body.pairwiseInput.trim() : "";
    const model = typeof body.model === "string" ? body.model : "PP";
    const feature = typeof body.feature === "string" ? body.feature : "best";
    const hostInputType = body.hostInputType as FastaType;
    const pathogenInputType = body.pathogenInputType as FastaType;
    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (!["PP", "HBP", "HVP", "AP"].includes(model)) throw new RequestSecurityError("Unsupported DeepHPI model family.", 400);
    if (!["best", "fast"].includes(feature)) throw new RequestSecurityError("Unsupported prediction mode.", 400);
    if (!["protein", "nucleotide"].includes(hostInputType) || !["protein", "nucleotide"].includes(pathogenInputType)) throw new RequestSecurityError("Host and pathogen input types must be selected.", 400);
    if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new RequestSecurityError("Notification email is invalid.", 400);
    const host = validateFasta(hostInput, "Host", hostInputType);
    const pathogen = validateFasta(pathogenInput, "Pathogen", pathogenInputType);
    if (host.residues + pathogen.residues > REQUEST_LIMITS.totalResidues) throw new RequestSecurityError("The combined host and pathogen input exceeds the total residue limit.", 400);
    const pairwiseCount = validatePairwise(pairwiseInput, host.ids, pathogen.ids);
    if (!pairwiseCount && host.count * pathogen.count > REQUEST_LIMITS.candidatePairs) throw new RequestSecurityError(`The full Cartesian screen exceeds ${REQUEST_LIMITS.candidatePairs} candidate pairs. Submit fewer sequences or provide a pairwise restriction.`, 400);
    await verifyTurnstile(body.turnstileToken, ip);

    const jobId = `deephpi_${crypto.randomUUID().replaceAll("-", "")}`;
    const jobToken = crypto.randomBytes(32).toString("base64url");
    const job = await createPredictionJob({
      jobId, hostInput, pathogenInput, pairwiseInput, model, feature, hostInputType, pathogenInputType, email,
      hostSequenceCount: host.count, pathogenSequenceCount: pathogen.count, pairwiseCount,
      tokenHash: hashJobToken(jobToken), ownerHash: ownerHash(ip),
    });
    return NextResponse.json({ ...publicJob(job), jobToken }, { status: 202, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const securityResponse = securityErrorResponse(error);
    if (securityResponse) return securityResponse;
    if (error instanceof JobCapacityError) return NextResponse.json({ error: error.message }, { status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" } });
    console.error("DeepHPI job submission failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "DeepHPI job submission failed." }, { status: 500 });
  }
}
