import { NextRequest, NextResponse } from "next/server";
import { readPredictionJob, verifyJobToken, type JobRecord } from "@/lib/prediction-jobs";
import { bearerToken, clientIp, enforceRateLimit, securityErrorResponse } from "@/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const isMissingFile = (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";

export const publicJob = (job: JobRecord) => ({
  jobId: job.jobId, status: job.status, message: job.message, createdAt: job.createdAt, updatedAt: job.updatedAt,
  model: job.model, feature: job.feature, hostInputType: job.hostInputType, pathogenInputType: job.pathogenInputType,
  hostSequenceCount: job.hostSequenceCount, pathogenSequenceCount: job.pathogenSequenceCount, pairwiseCount: job.pairwiseCount,
  stage: job.stage, summary: job.summary, error: job.error,
});

export async function GET(req: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  try {
    enforceRateLimit("job-status", clientIp(req), 120, 60 * 1000);
    const { jobId } = await context.params;
    const job = await readPredictionJob(jobId);
    if (!verifyJobToken(job, bearerToken(req))) return NextResponse.json({ error: "DeepHPI job was not found." }, { status: 404, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json(publicJob(job), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const securityResponse = securityErrorResponse(error);
    if (securityResponse) return securityResponse;
    const missing = isMissingFile(error);
    return NextResponse.json({ error: missing ? "DeepHPI job was not found." : "Job status is temporarily unavailable." }, { status: missing ? 404 : 503, headers: { "Cache-Control": "no-store", ...(missing ? {} : { "Retry-After": "15" }) } });
  }
}
