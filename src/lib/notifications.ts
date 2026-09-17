import nodemailer from "nodemailer";
import type { JobRecord } from "./prediction-jobs";

export type NotificationEvent = "submitted" | "completed" | "failed";

export async function sendJobNotification(job: JobRecord, event: NotificationEvent) {
  const host = process.env.DEEPHPI_SMTP_HOST?.trim();
  const from = process.env.DEEPHPI_MAIL_FROM?.trim();
  if (!job.email || !host || !from) return false;
  const port = Number.parseInt(process.env.DEEPHPI_SMTP_PORT || "587", 10);
  const secure = process.env.DEEPHPI_SMTP_SSL === "true";
  const user = process.env.DEEPHPI_SMTP_USER?.trim();
  const pass = process.env.DEEPHPI_SMTP_PASS || "";
  const transport = nodemailer.createTransport({
    host, port, secure,
    auth: user ? { user, pass } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    requireTLS: !secure && process.env.DEEPHPI_SMTP_TLS !== "false",
  });
  const baseUrl = (process.env.DEEPHPI_APP_URL || "").replace(/\/$/, "");
  const resultUrl = `${baseUrl}/results/${job.jobId}`;
  const subjects = {
    submitted: `DeepHPI job submitted: ${job.jobId}`,
    completed: `DeepHPI job completed: ${job.jobId}`,
    failed: `DeepHPI job failed: ${job.jobId}`,
  };
  const details = event === "completed"
    ? `Predicted interactions: ${job.summary?.interactionCount ?? 0}`
    : event === "failed" ? `Error: ${job.error || "The prediction did not complete."}` : "The job is waiting for HPC execution.";
  await transport.sendMail({
    from, to: job.email, subject: subjects[event],
    text: `DeepHPI job: ${job.jobId}\nStatus: ${event}\n${details}\nResults: ${resultUrl}\n`,
  });
  return true;
}
