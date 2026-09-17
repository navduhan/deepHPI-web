import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, clientIp, enforceRateLimit, parseAccessions, readJsonBody, REQUEST_LIMITS, RequestSecurityError, securityErrorResponse, validateFasta } from "@/lib/request-security";

async function fetchFasta(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(12_000), cache: "no-store" });
  if (!response.ok) return "";
  const declaredLength = Number.parseInt(response.headers.get("content-length") || "0", 10);
  if (declaredLength > REQUEST_LIMITS.bodyBytes) throw new RequestSecurityError("The remote FASTA response is too large.", 413);
  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > REQUEST_LIMITS.bodyBytes) throw new RequestSecurityError("The remote FASTA response is too large.", 413);
  return text;
}

async function fetchUniProt(accessions: string[]) {
  const results: string[] = [];
  for (let offset = 0; offset < accessions.length; offset += 5) {
    results.push(...await Promise.all(accessions.slice(offset, offset + 5).map((id) => fetchFasta(`https://rest.uniprot.org/uniprotkb/${encodeURIComponent(id)}.fasta`))));
  }
  return results.filter(Boolean).join("\n");
}

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    enforceRateLimit("accession", clientIp(req), 20, 60 * 1000);
    const body = await readJsonBody<{ accessions?: unknown; db?: unknown }>(req);
    const accessions = parseAccessions(body.accessions);
    if (body.db !== "ncbi" && body.db !== "uniprot") throw new RequestSecurityError("Database must be NCBI or UniProt.", 400);
    const fasta = body.db === "ncbi"
      ? await fetchFasta(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=protein&id=${encodeURIComponent(accessions.join(","))}&rettype=fasta&retmode=text`)
      : await fetchUniProt(accessions);
    const validation = validateFasta(fasta, "Retrieved", "protein");
    return NextResponse.json({ fasta, count: validation.count, accessions }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const securityResponse = securityErrorResponse(error);
    if (securityResponse) return securityResponse;
    return NextResponse.json({ error: "The requested protein accessions could not be retrieved." }, { status: 502 });
  }
}
