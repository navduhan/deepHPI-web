import { NextRequest, NextResponse } from "next/server";
import { readPredictionJob, verifyJobToken } from "@/lib/prediction-jobs";
import { bearerToken, clientIp, enforceRateLimit } from "@/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const isMissingFile = (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";

export async function GET(req: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  try {
    enforceRateLimit("job-results", clientIp(req), 60, 60 * 1000);
    const { jobId } = await context.params;
    const job = await readPredictionJob(jobId);
    if (!verifyJobToken(job, bearerToken(req))) return NextResponse.json({ error: "DeepHPI job was not found." }, { status: 404 });
    if (job.status !== "completed") return NextResponse.json({ error: "DeepHPI results are not available yet." }, { status: 409 });
    return NextResponse.json(job.results, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const missing = isMissingFile(error);
    return NextResponse.json({ error: missing ? "DeepHPI job was not found." : "DeepHPI results are temporarily unavailable." }, { status: missing ? 404 : 503, headers: missing ? undefined : { "Retry-After": "15" } });
  }
}
