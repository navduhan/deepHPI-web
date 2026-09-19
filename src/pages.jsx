import { useEffect, useMemo, useState } from "react";
import { NetworkGraph } from "./components/NetworkGraph";
import { ResultsTable } from "./components/ResultsTable";
import { RouteLink } from "./components/AppShell";
import { SubmissionWorkspace } from "./components/SubmissionWorkspace";
import { ManuscriptCitation, ServiceLimits } from "./components/ServiceInformation";
import {
  aboutParagraphs,
  covidProteins,
  datasetParagraphs,
  modelOptions,
} from "./content/siteContent";
import { api } from "./lib/api";
import { withBasePath } from "./lib/base-path";

function PageFrame({
  eyebrow,
  title,
  detail,
  actions,
  children,
  contentClassName = "max-w-5xl",
  detailClassName = "max-w-3xl",
  headerAlign = "stacked",
}) {
  return (
    <div className="space-y-5">
      <section className="paper-panel atlas-ring relative overflow-hidden rounded-[1.75rem] px-5 py-6 md:px-7 md:py-7">
        <div className="pointer-events-none absolute inset-0 technical-grid opacity-20" />
        <div className={`relative ${contentClassName}`}>
          <div className={headerAlign === "split" ? "flex flex-col gap-4 md:flex-row md:items-start md:justify-between" : ""}>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-cobalt">{eyebrow}</p>
              <h1 className="mt-3 font-display text-4xl font-semibold leading-[1.08] tracking-[-0.03em] text-ink md:text-5xl">{title}</h1>
              {detail ? <p className={`mt-4 text-sm leading-7 text-ink/82 md:text-base ${detailClassName}`}>{detail}</p> : null}
            </div>
            {actions ? <div className={headerAlign === "split" ? "md:pt-2" : "mt-5 flex flex-wrap gap-3"}>{actions}</div> : null}
          </div>
        </div>
      </section>
      {children}
    </div>
  );
}

function StatCard({ label, value, note }) {
  return (
    <div className="paper-panel atlas-ring rounded-[1.25rem] p-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/80">{label}</p>
      <p className="mt-4 text-4xl font-semibold text-ink">{value}</p>
      <p className="mt-3 text-sm leading-6 text-ink/78">{note}</p>
    </div>
  );
}

function JobStatusPill({ status }) {
  const palette = {
    queued: "border-amber/18 bg-amber/8 text-amber",
    running: "border-cobalt/18 bg-cobalt/8 text-cobalt",
    completed: "border-[#5c9d62]/20 bg-[#eaf7ec] text-[#2f7a39]",
    failed: "border-crimson/18 bg-crimson/8 text-crimson",
  };

  return (
    <span className={`rounded-full border px-4 py-3 font-mono text-[11px] uppercase tracking-[0.22em] ${palette[status] || "border-ink/14 bg-white/70 text-ink/70"}`}>
      {status}
    </span>
  );
}

function InfoCard({ title, body }) {
  return (
    <div className="paper-panel atlas-ring rounded-[1.25rem] p-5">
      <h3 className="text-xl font-semibold text-ink">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-ink/80">{body}</p>
    </div>
  );
}

const helpContents = [
  ["quick-start", "Quick start"],
  ["sequence-input", "Sequence input"],
  ["model-family", "Model families"],
  ["prediction-mode", "Prediction modes"],
  ["pairwise", "Pairwise restriction"],
  ["results", "Reading results"],
  ["network", "Network atlas"],
  ["limits", "Submission limits"],
  ["privacy", "Privacy and retention"],
  ["troubleshooting", "Troubleshooting"],
  ["limitations", "Interpretation"],
  ["citation", "Citation"],
];

function HelpSection({ id, eyebrow, title, children }) {
  return (
    <section id={id} className="paper-panel atlas-ring scroll-mt-6 rounded-[1.5rem] p-5 md:p-7">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-cobalt">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-ink md:text-3xl">{title}</h2>
      <div className="mt-5 space-y-4 text-sm leading-7 text-ink/78">{children}</div>
    </section>
  );
}

function parseCovidTable(rawText) {
  const lines = rawText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return [];
  }

  const header = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const columns = line.split(",");
    return Object.fromEntries(header.map((key, index) => [key, columns[index] || ""]));
  });
}

function downloadCovidRows(selectedProtein, rows) {
  if (!rows.length) {
    return;
  }

  const header = ["Host accession", "Gene symbol", "Viral protein", "Viral accession"];
  const body = rows.map((row) =>
    [row.proteinA || "", row.Gene_Symbol || "", row.proteinB || "", row.Accession || ""].join("\t"),
  );
  const blob = new Blob([[header.join("\t"), ...body].join("\n")], {
    type: "text/tab-separated-values",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${selectedProtein}_ppi.tsv`;
  link.click();
  URL.revokeObjectURL(url);
}

function normalizeCovidNetwork(rawNetwork, selectedProtein) {
  const sourceNodes = Array.isArray(rawNetwork?.nodes) ? rawNetwork.nodes : [];
  const sourceEdges = Array.isArray(rawNetwork?.edges) ? rawNetwork.edges : [];

  const nodes = sourceNodes.map((node) => {
    const isPathogen = node.id === selectedProtein || node.label === selectedProtein;
    return {
      id: node.id,
      label: node.label || node.id,
      type: isPathogen ? "pathogen" : "host",
      degree: 0,
      hit: "",
      hitAccession: "",
      description: "",
      organism: "",
      go: "",
    };
  });

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));

  const edges = sourceEdges.map((edge, index) => {
    const source = edge.source;
    const target = edge.target;
    const sourceNode = nodeMap.get(source);
    const targetNode = nodeMap.get(target);

    if (sourceNode) {
      sourceNode.degree += 1;
    }
    if (targetNode) {
      targetNode.degree += 1;
    }

    return {
      id: edge.id || `${source}-${target}-${index}`,
      source,
      target,
    };
  });

  const interactions = edges.map((edge) => {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    const hostNode = sourceNode?.type === "host" ? sourceNode : targetNode;
    const pathogenNode = sourceNode?.type === "pathogen" ? sourceNode : targetNode;

    return {
      id: edge.id,
      hostProtein: hostNode?.label || hostNode?.id || edge.source,
      hostHit: "",
      pathogenProtein: pathogenNode?.label || pathogenNode?.id || edge.target,
      pathogenHit: "",
      confidence: 0,
    };
  });

  return { nodes, edges, interactions };
}

export function SubmitPage({ navigate }) {
  return <SubmissionWorkspace navigate={navigate} />;
}

export function HomePage({ navigate }) {
  return (
    <div className="space-y-5">
      <section className="dark-panel relative overflow-hidden rounded-[2rem] text-white">
        <div className="pointer-events-none absolute inset-0 technical-grid opacity-[0.12]" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -right-8 top-12 h-52 w-52 rounded-full border border-white/10" />
        <div className="relative grid min-h-[520px] gap-8 px-6 py-8 md:px-10 md:py-10 xl:grid-cols-[1.02fr_0.98fr] xl:items-center xl:px-12">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/[0.07] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.24em] text-[#cfe4f7]">
              <span className="h-2 w-2 rounded-full bg-[#e39055]" />
              DeepHPI webserver
            </div>
            <h1 className="mt-7 max-w-3xl font-display text-5xl font-semibold leading-[0.98] tracking-[-0.05em] md:text-6xl xl:text-[4.6rem]">
              Predict host–pathogen protein interactions from sequence.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-[#d9e7f3] md:text-lg">
              Submit host and pathogen FASTA sequences, choose the appropriate DeepHPI model, and receive a private report with ranked interaction scores and an explorable network.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <RouteLink
                href="/submit"
                navigate={navigate}
                className="rounded-full bg-white px-6 py-3.5 text-sm font-bold !text-panel transition hover:bg-[#e8f2fb]"
              >
                Run DeepHPI
              </RouteLink>
              <RouteLink
                href="/human-covid-ppi"
                navigate={navigate}
                className="rounded-full border border-white/20 bg-white/[0.06] px-6 py-3.5 text-sm font-bold !text-white transition hover:bg-white/[0.12]"
              >
                Browse Human–COVID-19 data
              </RouteLink>
            </div>
            <div className="mt-10 grid max-w-2xl grid-cols-3 border-t border-white/15 pt-6">
              {[
                ["4", "trained model families"],
                ["AA / NT", "accepted sequence input"],
                ["Private", "job-specific reports"],
              ].map(([value, label]) => (
                <div key={label} className="border-l border-white/15 pl-4 first:border-l-0 first:pl-0">
                  <p className="text-3xl font-semibold">{value}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.12em] text-[#b8cfe2]">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-2xl xl:ml-auto">
            <div className="absolute -inset-5 rotate-2 rounded-[2.2rem] border border-white/10 bg-white/[0.025]" />
            <div className="relative overflow-hidden rounded-[1.9rem] border border-white/12 bg-white/[0.035] p-4 shadow-[0_30px_70px_rgba(2,17,32,0.3)] md:p-6">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_46%,rgba(255,255,255,0.10),transparent_58%)]" />
              <img
                src={withBasePath("/assets/deephpi-ppi-hero.png")}
                alt="Illustration of a host protein interacting with a pathogen protein and forming an interaction network"
                className="relative h-[340px] w-full object-contain drop-shadow-[0_24px_30px_rgba(2,17,32,0.28)] md:h-[430px]"
              />
              <div className="relative grid grid-cols-3 gap-2 border-t border-white/10 pt-4">
                {[
                  ["#4f91d5", "Host protein"],
                  ["#df795c", "Pathogen protein"],
                  ["#dce8f3", "Interaction network"],
                ].map(([color, label]) => (
                  <div key={label} className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-2.5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                    <p className="text-center text-[11px] font-semibold text-[#dce9f4]">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="paper-panel atlas-ring overflow-hidden rounded-[1.75rem]">
        <div className="grid gap-6 border-b border-ink/12 px-6 py-7 md:px-8 xl:grid-cols-[0.78fr_1.22fr] xl:items-end">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-cobalt">Inside one prediction job</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.03em] text-ink md:text-4xl">
              Input, prediction, and review stay connected.
            </h2>
          </div>
          <p className="max-w-3xl text-sm leading-7 text-ink/72 xl:justify-self-end">
            DeepHPI keeps each submission in a job-specific workspace. The same job links the submitted sequences, selected model, ranked interaction pairs, and network view, so you can move through the results without rebuilding the analysis elsewhere.
          </p>
        </div>

        <div className="relative bg-[#f7fafc] p-5 md:p-8">
          <div className="pointer-events-none absolute inset-0 technical-grid opacity-[0.28]" />
          <div className="relative grid gap-4 xl:grid-cols-[1fr_44px_0.86fr_44px_1.2fr] xl:items-stretch">
            <div className="rounded-[1.35rem] border border-ink/12 bg-white p-5 shadow-[0_14px_32px_rgba(18,61,103,0.08)]">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-cobalt">01 / Sequence input</p>
                <span className="rounded-full border border-ink/10 px-2.5 py-1 font-mono text-[9px] text-ink/55">FASTA</span>
              </div>
              <div className="mt-5 space-y-3">
                <div className="rounded-xl border border-cobalt/18 border-l-[3px] border-l-cobalt bg-[#f7fbff] p-3">
                  <p className="text-xs font-bold text-ink">Host sequences</p>
                  <div className="mt-3 space-y-1.5">
                    <span className="block h-1.5 w-4/5 rounded-full bg-cobalt/18" />
                    <span className="block h-1.5 w-3/5 rounded-full bg-cobalt/12" />
                  </div>
                </div>
                <div className="rounded-xl border border-[#d46a57]/18 border-l-[3px] border-l-[#d46a57] bg-[#fff9f7] p-3">
                  <p className="text-xs font-bold text-ink">Pathogen sequences</p>
                  <div className="mt-3 space-y-1.5">
                    <span className="block h-1.5 w-3/4 rounded-full bg-[#d46a57]/20" />
                    <span className="block h-1.5 w-2/3 rounded-full bg-[#d46a57]/12" />
                  </div>
                </div>
              </div>
              <p className="mt-4 text-xs leading-5 text-ink/60">Paste sequences, upload FASTA files, or retrieve protein accessions.</p>
            </div>

            <div className="hidden items-center justify-center xl:flex" aria-hidden="true">
              <div className="relative h-px w-full bg-cobalt/25">
                <span className="absolute -right-0.5 -top-1 h-2.5 w-2.5 rotate-45 border-r-2 border-t-2 border-cobalt/55" />
              </div>
            </div>

            <div className="rounded-[1.35rem] border border-ink/12 bg-white p-5 shadow-[0_14px_32px_rgba(18,61,103,0.08)]">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-cobalt">02 / DeepHPI model</p>
              <h3 className="mt-2 text-lg font-semibold text-ink">Choose the matching system</h3>
              <div className="mt-4 space-y-2">
                {modelOptions.map((model, index) => (
                  <div key={model.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-xs font-semibold ${index === 0 ? "border-cobalt bg-[#eef5fb] text-cobalt" : "border-ink/10 bg-white text-ink/62"}`}>
                    <span className={`h-3.5 w-3.5 rounded-full border ${index === 0 ? "border-[4px] border-cobalt" : "border-ink/25"}`} />
                    {model.label}
                  </div>
                ))}
              </div>
            </div>

            <div className="hidden items-center justify-center xl:flex" aria-hidden="true">
              <div className="relative h-px w-full bg-cobalt/25">
                <span className="absolute -right-0.5 -top-1 h-2.5 w-2.5 rotate-45 border-r-2 border-t-2 border-cobalt/55" />
              </div>
            </div>

            <div className="rounded-[1.35rem] border border-ink/12 bg-white p-5 shadow-[0_14px_32px_rgba(18,61,103,0.08)]">
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-cobalt">03 / Private report</p>
                <span className="rounded-full bg-[#edf6ef] px-2.5 py-1 font-mono text-[9px] font-bold text-[#3f6e4a]">Completed</span>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_0.9fr]">
                <div className="space-y-2">
                  {[
                    ["HSP_001 × PAT_014", "0.963"],
                    ["HSP_009 × PAT_006", "0.921"],
                    ["HSP_004 × PAT_021", "0.884"],
                  ].map(([pair, score], index) => (
                    <div key={pair} className="rounded-xl border border-ink/10 bg-[#fafcfd] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate font-mono text-[9px] text-ink/65">{pair}</span>
                        <span className="font-mono text-[10px] font-bold text-cobalt">{score}</span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-ink/8">
                        <div className="h-full rounded-full bg-cobalt" style={{ width: `${92 - index * 9}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="relative min-h-[170px] overflow-hidden rounded-xl border border-ink/10 bg-[#f8fbfd]">
                  <svg viewBox="0 0 210 170" className="absolute inset-0 h-full w-full" role="img" aria-label="Example interaction network">
                    <g stroke="#b7c7d6" strokeWidth="2">
                      <line x1="105" y1="84" x2="45" y2="38" /><line x1="105" y1="84" x2="165" y2="35" />
                      <line x1="105" y1="84" x2="48" y2="132" /><line x1="105" y1="84" x2="166" y2="132" />
                      <line x1="45" y1="38" x2="165" y2="35" opacity="0.45" />
                    </g>
                    <circle cx="105" cy="84" r="17" fill="#d46a57" />
                    <circle cx="45" cy="38" r="10" fill="#2a6db0" /><circle cx="165" cy="35" r="13" fill="#2a6db0" />
                    <circle cx="48" cy="132" r="12" fill="#2a6db0" /><circle cx="166" cy="132" r="9" fill="#2a6db0" />
                  </svg>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-semibold text-ink/62">
                <span className="rounded-full border border-ink/10 px-3 py-1.5">Ranked pairs</span>
                <span className="rounded-full border border-ink/10 px-3 py-1.5">Downloadable files</span>
                <span className="rounded-full border border-ink/10 px-3 py-1.5">Network atlas</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.72fr_1.28fr]">
        <div className="paper-panel atlas-ring rounded-[1.75rem] p-6 md:p-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-cobalt">Model coverage</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-ink">Choose the model that matches your host–pathogen system.</h2>
          <p className="mt-4 text-sm leading-7 text-ink/76">
            The webserver provides four trained model families. Each accepts the same submission format, while the selected family determines which DeepHPI model processes the job.
          </p>
          <RouteLink href="/datasets" navigate={navigate} className="mt-7 inline-flex rounded-full border border-panel bg-panel px-5 py-3 text-sm font-bold !text-white">
            Review datasets
          </RouteLink>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {modelOptions.map((model, index) => (
            <div key={model.id} className="paper-panel atlas-ring group rounded-[1.5rem] p-5 transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_45px_rgba(18,61,103,0.14)]">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-cobalt/8 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-cobalt">{model.tag}</span>
                <span className="font-mono text-xs text-ink/35">0{index + 1}</span>
              </div>
              <h3 className="mt-5 text-xl font-semibold text-ink">{model.label}</h3>
              <p className="mt-2 text-sm leading-6 text-ink/72">{model.note}</p>
            </div>
          ))}
        </div>
      </section>

      <ManuscriptCitation />
    </div>
  );
}

export function AboutPage() {
  return (
    <PageFrame
      eyebrow="About the service"
      title="DeepHPI predicts host-pathogen protein interactions from sequence."
      detail="The webserver supports sequence submission, ranked interaction reporting, and network-based inspection of predicted host-pathogen protein pairs."
      contentClassName="max-w-none"
      detailClassName="max-w-5xl"
    >
      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-5">
          {aboutParagraphs.map((paragraph) => (
            <InfoCard key={paragraph.slice(0, 48)} title="DeepHPI" body={paragraph} />
          ))}
        </div>
        <div className="paper-panel atlas-ring rounded-[1.25rem] p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-cobalt">Overview figure</p>
          <img
            src={withBasePath("/assets/DeepHPI-GA.png")}
            alt="DeepHPI overview"
            className="mt-5 w-full rounded-[1rem] border border-ink/12 bg-white p-3"
          />
        </div>
      </div>
    </PageFrame>
  );
}

export function DatasetsPage() {
  return (
    <PageFrame
      eyebrow="Datasets"
      title="Model families and supported biological systems."
      detail="DeepHPI includes dedicated prediction settings for multiple host-pathogen systems, each corresponding to the biological data used for model development."
      contentClassName="max-w-none"
      detailClassName="max-w-5xl"
    >
      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="paper-panel atlas-ring rounded-[1.25rem] p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-cobalt">Dataset map</p>
          <img
            src={withBasePath("/assets/DeepHPI_Dataset.png")}
            alt="DeepHPI dataset overview"
            className="mt-5 w-full rounded-[1rem] border border-ink/12 bg-white p-3"
          />
        </div>

        <div className="space-y-5">
          {datasetParagraphs.map((paragraph, index) => (
            <InfoCard key={paragraph.slice(0, 48)} title={`Dataset note ${index + 1}`} body={paragraph} />
          ))}

          <div className="grid gap-4 md:grid-cols-2">
            {modelOptions.map((model) => (
              <div key={model.id} className="paper-panel atlas-ring rounded-[1.25rem] p-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-cobalt">{model.tag}</p>
                <p className="mt-2 text-lg font-semibold text-ink">{model.label}</p>
                <p className="mt-2 text-sm leading-6 text-ink/80">{model.note}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageFrame>
  );
}

export function HelpPage({ navigate }) {
  return (
    <PageFrame
      eyebrow="User guide"
      title="Using the DeepHPI webserver."
      detail="Prepare host and pathogen sequences, choose the correct model, submit a private prediction job, and interpret the ranked report and interaction network."
      actions={
        <RouteLink href="/submit" navigate={navigate} className="rounded-full bg-panel px-5 py-3 text-sm font-bold !text-white transition hover:bg-cobalt">
          Start a prediction
        </RouteLink>
      }
      contentClassName="max-w-none"
      detailClassName="max-w-5xl"
      headerAlign="split"
    >
      <div className="grid items-start gap-5 xl:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="paper-panel atlas-ring rounded-[1.5rem] p-5 xl:sticky xl:top-5">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-cobalt">On this page</p>
          <nav aria-label="Help contents" className="mt-4">
            <ol className="space-y-1">
              {helpContents.map(([id, label], index) => (
                <li key={id}>
                  <a href={`#${id}`} className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-ink/72 transition hover:bg-cobalt/[0.06] hover:text-cobalt">
                    <span className="font-mono text-[9px] text-ink/38">{String(index + 1).padStart(2, "0")}</span>
                    {label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <div className="mt-5 border-t border-ink/12 pt-5">
            <p className="text-xs leading-6 text-ink/62">Results are protected by a private browser token. Keep using the same browser profile when returning to a job.</p>
          </div>
        </aside>

        <div className="min-w-0 space-y-5">
          <HelpSection id="quick-start" eyebrow="01 / Quick start" title="Run a prediction in five steps">
            <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {[
                ["1", "Choose a model", "Select the host–pathogen system that matches the submitted datasets."],
                ["2", "Add both inputs", "Paste FASTA, upload files, or retrieve protein accessions."],
                ["3", "Set the run", "Choose Sensitive or Faster and confirm AA or NT for each side."],
                ["4", "Submit the job", "Complete verification when enabled, then run the prediction."],
                ["5", "Review output", "Keep the results page open or return from the same browser profile."],
              ].map(([number, title, body]) => (
                <li key={number} className="rounded-[1rem] border border-ink/12 bg-white p-4">
                  <span className="font-mono text-xs font-bold text-[#d46a57]">{number}</span>
                  <p className="mt-3 font-semibold text-ink">{title}</p>
                  <p className="mt-2 text-xs leading-6 text-ink/68">{body}</p>
                </li>
              ))}
            </ol>
          </HelpSection>

          <HelpSection id="sequence-input" eyebrow="02 / Input" title="Prepare host and pathogen FASTA">
            <p>Host and pathogen inputs are separate. Every record must begin with a <code>&gt;</code> header, followed by one or more sequence lines. DeepHPI uses the first whitespace-delimited word in the header as the sequence identifier, so that value must be unique within its input.</p>
            <pre className="overflow-x-auto rounded-[1rem] border border-ink/12 bg-[#f7fafc] p-4 font-mono text-xs leading-6 text-ink">{`>host_protein_1\nMSTNPKPQRKTKRNTNRRPQDVKFPGG\n>host_protein_2\nMALWMRLLPLLALLALWGPGPGAG`}</pre>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-[1rem] border border-cobalt/16 bg-[#f7fbff] p-4">
                <h3 className="font-semibold text-ink">Amino acid (AA)</h3>
                <p className="mt-2">Accepts the standard amino acids plus B, X, Z, J, U, O, <code>*</code>, and <code>-</code>. Characters are normalized to uppercase.</p>
              </div>
              <div className="rounded-[1rem] border border-[#d46a57]/16 bg-[#fff9f7] p-4">
                <h3 className="font-semibold text-ink">Nucleotide (NT)</h3>
                <p className="mt-2">Accepts A, C, G, T, U, N and the IUPAC ambiguity codes R, Y, K, M, S, W, B, D, H, and V, plus <code>-</code>.</p>
              </div>
            </div>
            <p>Nucleotide input is translated on the compute backend with TransDecoder before prediction. A nucleotide record may produce one or more translated proteins, or none if no suitable coding region is found.</p>
            <h3 className="pt-2 text-lg font-semibold text-ink">Upload, paste, or retrieve accessions</h3>
            <p>FASTA files may use <code>.fa</code>, <code>.faa</code>, <code>.fasta</code>, or <code>.txt</code>. Protein accessions can be retrieved from UniProt or NCBI Protein independently for host and pathogen. Review retrieved FASTA before submission. Accession retrieval loads protein sequences and therefore sets that side to AA.</p>
          </HelpSection>

          <HelpSection id="model-family" eyebrow="03 / Model selection" title="Choose the model family">
            <p>Each model family is a separate trained inference profile. Choose the family that matches the host and pathogen system represented by the submitted sequences.</p>
            <div className="grid gap-3 md:grid-cols-2">
              {modelOptions.map((model) => (
                <div key={model.id} className="rounded-[1rem] border border-ink/12 bg-white p-4">
                  <div className="flex items-center gap-3"><span className="rounded-full bg-cobalt/[0.08] px-3 py-1.5 font-mono text-[10px] font-bold text-cobalt">{model.tag}</span><h3 className="font-semibold text-ink">{model.label}</h3></div>
                  <p className="mt-3 text-xs leading-6 text-ink/68">{model.note}</p>
                </div>
              ))}
            </div>
            <p>Loading a demo supplies a different host and pathogen example for the selected family. If the model is changed afterward, the demo inputs are cleared to prevent submitting one family’s example under another model.</p>
          </HelpSection>

          <HelpSection id="prediction-mode" eyebrow="04 / Runtime profile" title="Sensitive and Faster modes">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-[1rem] border border-cobalt/18 bg-[#f7fbff] p-4"><h3 className="font-semibold text-ink">Sensitive</h3><p className="mt-2">Uses the fuller descriptor configuration and is the default when broader recovery of possible interactions is the priority.</p></div>
              <div className="rounded-[1rem] border border-ink/12 bg-white p-4"><h3 className="font-semibold text-ink">Faster</h3><p className="mt-2">Uses a lighter descriptor profile to reduce runtime for exploratory screening and repeated tests.</p></div>
            </div>
            <p>The two modes use different runtime profiles. Scores should be interpreted within the selected run rather than compared as if the modes were identical models.</p>
          </HelpSection>

          <HelpSection id="pairwise" eyebrow="05 / Optional restriction" title="Score a defined list of pairs">
            <p>Leave the Pairwise field empty to evaluate the full host-by-pathogen Cartesian set. To score only selected combinations, provide exactly two tab-separated identifiers per line: submitted host ID first, submitted pathogen ID second. Do not include a header row.</p>
            <pre className="overflow-x-auto rounded-[1rem] border border-ink/12 bg-[#f7fafc] p-4 font-mono text-xs leading-6 text-ink">{`host_protein_1\tpathogen_protein_1\nhost_protein_2\tpathogen_protein_3`}</pre>
            <p>Every identifier must exactly match the first word of a submitted FASTA header. Space-separated or comma-separated rows are rejected. The pairwise list and a full Cartesian screen are each limited to 10,000 candidate pairs.</p>
          </HelpSection>

          <HelpSection id="results" eyebrow="06 / Report" title="Read and download the ranked results">
            <p>The results page follows the job through queued, running, completed, or failed states. A completed report summarizes interaction count, unique host proteins, and unique pathogen proteins, then sorts positive interaction calls by DeepHPI confidence score.</p>
            <div className="overflow-x-auto rounded-[1rem] border border-ink/12 bg-white">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-[#f2f6f9] text-ink"><tr><th className="p-3">Report field</th><th className="p-3">How to read it</th></tr></thead>
                <tbody className="divide-y divide-ink/10">
                  <tr><th className="p-3 font-semibold">Host / pathogen protein</th><td className="p-3">Submitted or translated identifiers for the predicted pair.</td></tr>
                  <tr><th className="p-3 font-semibold">SwissProt hit and GO</th><td className="p-3">DIAMOND-based reference annotation when a usable match is available; “no hit” is retained when none is returned.</td></tr>
                  <tr><th className="p-3 font-semibold">Confidence score</th><td className="p-3">The model output score for a predicted positive interaction, used for ranking within the report.</td></tr>
                  <tr><th className="p-3 font-semibold">Sequences</th><td className="p-3">Opens the submitted or translated sequences and available annotation details for that pair.</td></tr>
                </tbody>
              </table>
            </div>
            <p><strong>Download TSV</strong> exports the complete ranked table, including sequences, hit descriptions, organisms, GO terms, and confidence scores. If no pair crosses the deployed positive threshold, the job can complete successfully with an empty positive-interaction report.</p>
          </HelpSection>

          <HelpSection id="network" eyebrow="07 / Network" title="Explore the interaction atlas">
            <p>The network page represents host and pathogen proteins as nodes and predicted interactions as edges. Blue nodes are host proteins and orange nodes are pathogen proteins. Select a node to inspect its degree, SwissProt annotation, and connected proteins.</p>
            <ul className="grid gap-3 md:grid-cols-2">
              <li className="rounded-[1rem] border border-ink/12 bg-white p-4"><strong className="text-ink">Layouts</strong><br />Switch among Cose, Concentric, Circle, Breadthfirst, and Grid arrangements.</li>
              <li className="rounded-[1rem] border border-ink/12 bg-white p-4"><strong className="text-ink">Large graphs</strong><br />The browser view displays up to the 80 highest-degree nodes per side to keep interaction responsive.</li>
              <li className="rounded-[1rem] border border-ink/12 bg-white p-4"><strong className="text-ink">PNG export</strong><br />Exports the currently displayed network at higher resolution.</li>
              <li className="rounded-[1rem] border border-ink/12 bg-white p-4"><strong className="text-ink">JSON export</strong><br />Exports the complete network payload supplied to the page, including nodes, edges, and interaction records.</li>
            </ul>
            <p>The interaction-list panel can be opened for the selected node. Network connectivity summarizes model output; it does not by itself establish a physical interaction or biological mechanism.</p>
          </HelpSection>

          <div id="limits" className="scroll-mt-6 space-y-3">
            <ServiceLimits />
            <div className="paper-panel atlas-ring rounded-[1.35rem] p-4 md:p-5">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-cobalt">Additional service controls</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Request body", "4 MiB", "maximum JSON request size"],
                  ["Accession length", "64", "characters per identifier"],
                  ["Active jobs", "2 per client", "10 across the service"],
                  ["Submission rate", "3 per 10 min", "per client address"],
                ].map(([label, value, note]) => (
                  <div key={label} className="rounded-[0.95rem] border border-ink/12 bg-white px-3 py-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/55">{label}</p>
                    <p className="mt-2 text-lg font-semibold text-ink">{value}</p>
                    <p className="mt-1 text-xs leading-5 text-ink/62">{note}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs leading-6 text-ink/62">These are deployment defaults and may be changed by the server administrator. Follow a live validation message if it reports a different limit.</p>
            </div>
          </div>

          <HelpSection id="privacy" eyebrow="09 / Job access" title="Privacy, tokens, and retention">
            <p>Each submission receives an unguessable job identifier and a separate private token. The browser stores that token locally and sends it when requesting status, results, or network data. The server returns “not found” when a valid token is not available.</p>
            <p>Because the token is stored in the browser profile, opening only the visible results URL in another browser, private window, or device will not restore access. Keep the original browser profile available until the files you need have been downloaded.</p>
            <p>Web job records use private filesystem permissions. The compute workspace is removed after completed output is collected. Completed and failed web records use a configurable retention period; the default is 30 days. Download important results rather than treating the webserver as permanent storage.</p>
          </HelpSection>

          <HelpSection id="troubleshooting" eyebrow="10 / Troubleshooting" title="Common submission and report problems">
            <div className="divide-y divide-ink/10 rounded-[1rem] border border-ink/12 bg-white">
              {[
                ["FASTA is rejected", "Confirm the selected AA or NT type, begin every record with a header, use unique identifiers, remove unsupported symbols, and make sure no record is empty."],
                ["The candidate-pair limit is exceeded", "Reduce one or both sequence sets, or provide a two-column pairwise list containing no more than 10,000 submitted identifier pairs."],
                ["An accession cannot be retrieved", "Check the database selection and accession spelling. The fetch controls retrieve protein records only and may fail for unavailable or nucleotide-only identifiers."],
                ["The job remains queued", "The HPC scheduler has accepted the job but has not allocated resources yet. Keep the results page available and allow it to continue checking."],
                ["The service is at capacity", "Wait for active jobs to finish and try again. The default limit is two active jobs per client and ten active jobs across the service."],
                ["Results are not found after reopening", "Return with the browser profile that submitted the job. The private access token is stored locally and is not encoded in the visible URL."],
                ["No positive interactions are shown", "A completed empty report means no submitted pair crossed the deployed positive threshold; it is different from a failed job."],
                ["The network is slow", "Try Grid or Circle layout. Large graphs are clipped to a top-degree browser view while JSON export retains the complete network payload."],
              ].map(([problem, response]) => (
                <div key={problem} className="grid gap-2 p-4 md:grid-cols-[220px_minmax(0,1fr)]"><h3 className="font-semibold text-ink">{problem}</h3><p>{response}</p></div>
              ))}
            </div>
          </HelpSection>

          <HelpSection id="limitations" eyebrow="11 / Interpretation" title="Use predictions as prioritization evidence">
            <p>DeepHPI predicts sequence-based host–pathogen protein interaction scores. It does not experimentally demonstrate binding, define interaction direction, establish when or where proteins are expressed, or confirm the mechanism of an interaction.</p>
            <p>Performance can vary for sequence fragments, translated ORFs, ambiguous residues, proteins unlike the training data, and host–pathogen systems outside the selected model family. SwissProt and GO fields are similarity-based annotations and should not be treated as direct functional validation.</p>
            <p>Use the ranked output to prioritize candidates for comparison with homology, structural context, expression data, curated interaction databases, and experimental evidence. Scores from different model families or runtime modes are not interchangeable calibrated probabilities.</p>
          </HelpSection>

          <div id="citation" className="scroll-mt-6"><ManuscriptCitation /></div>
        </div>
      </div>
    </PageFrame>
  );
}

export function CovidPage({ protein = null, navigate }) {
  const [selectedProtein, setSelectedProtein] = useState("SARS-CoV-2_spike");
  const [rows, setRows] = useState([]);
  const [network, setNetwork] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const viewingNetwork = Boolean(protein);

  useEffect(() => {
    if (protein) {
      setSelectedProtein(protein);
    }
  }, [protein]);

  useEffect(() => {
    let active = true;

    async function loadDataset() {
      setLoading(true);
      setError("");

      try {
        if (viewingNetwork) {
          const response = await fetch(withBasePath(`/covid/${selectedProtein}_ppi.json`));
          if (!response.ok) {
            throw new Error("Unable to load the selected SARS-CoV-2 interaction network.");
          }
          const rawNetwork = await response.json();
          if (active) {
            setNetwork(normalizeCovidNetwork(rawNetwork, selectedProtein));
            setRows([]);
          }
          return;
        }

        const response = await fetch(withBasePath(`/covid/${selectedProtein}_ppi.txt`));
        if (!response.ok) {
          throw new Error("Unable to load the selected SARS-CoV-2 interaction set.");
        }
        const text = await response.text();
        if (active) {
          const parsedRows = parseCovidTable(text);
          setRows(parsedRows);
          setNetwork(null);
        }
      } catch (datasetError) {
        if (active) {
          setError(datasetError.message);
          setRows([]);
          setNetwork(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadDataset();
    return () => {
      active = false;
    };
  }, [selectedProtein, viewingNetwork]);

  const previewRows = rows.slice(0, 120);

  return (
    <PageFrame
      eyebrow="Human-COVID-PPI"
      title={
        viewingNetwork
          ? `Interaction network for ${selectedProtein}`
          : "Browse Human-COVID-PPI interaction tables."
      }
      detail={
        viewingNetwork
          ? ""
          : "Select a SARS-CoV-2 protein to review its curated interaction table and open the corresponding network view."
      }
      actions={
        viewingNetwork ? (
          <RouteLink
            href="/human-covid-ppi"
            navigate={navigate}
            className="rounded-full border border-ink/14 bg-white px-4 py-3 font-mono text-[11px] uppercase tracking-[0.22em] text-ink/74 transition hover:border-cobalt/24"
          >
            Back to Table
          </RouteLink>
        ) : null
      }
      contentClassName="max-w-none"
      detailClassName="max-w-none"
      headerAlign={viewingNetwork ? "split" : "stacked"}
    >
      {viewingNetwork ? (
        loading ? (
          <div className="paper-panel atlas-ring rounded-[1.25rem] px-5 py-8 text-sm text-ink/78">
            Loading Human-COVID-PPI network...
          </div>
        ) : error ? (
          <div className="paper-panel atlas-ring rounded-[1.25rem] px-5 py-8 text-sm text-crimson">
            {error}
          </div>
        ) : network?.nodes ? (
          <NetworkGraph nodes={network.nodes} edges={network.edges} interactions={network.interactions} />
        ) : (
          <div className="paper-panel atlas-ring rounded-[1.25rem] px-5 py-8 text-sm text-ink/78">
            No network is available for this SARS-CoV-2 protein.
          </div>
        )
      ) : (
        <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="paper-panel atlas-ring rounded-[1.25rem] p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-cobalt">SARS-CoV-2 protein</p>
            <select
              value={selectedProtein}
              onChange={(event) => {
                setSelectedProtein(event.target.value);
              }}
              className="mt-4 w-full rounded-[1rem] border border-ink/14 bg-white px-4 py-3 text-sm outline-none transition focus:border-cobalt"
            >
              {covidProteins.map((protein) => (
                <option key={protein} value={protein}>
                  {protein}
                </option>
              ))}
            </select>

            <div className="mt-5 space-y-3">
              <div className="rounded-[1rem] border border-ink/12 bg-paper px-4 py-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/58">Selected view</p>
                <p className="mt-2 text-lg font-semibold text-ink">{selectedProtein}</p>
              </div>
              <div className="rounded-[1rem] border border-ink/12 bg-paper px-4 py-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/58">Interactions</p>
                <p className="mt-2 text-3xl font-semibold text-ink">{rows.length.toLocaleString()}</p>
              </div>
              <RouteLink
                href={`/human-covid-ppi/${encodeURIComponent(selectedProtein)}`}
                navigate={navigate}
                className="inline-flex w-full items-center justify-center rounded-full bg-[#123a61] px-5 py-3 text-sm font-semibold !text-white transition hover:bg-[#1d5584]"
              >
                Visualize Network
              </RouteLink>
            </div>
          </div>

          <div className="paper-panel atlas-ring rounded-[1.25rem] overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/12 px-5 py-4">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-cobalt">COVID interaction table</p>
                <p className="mt-1 text-sm text-ink/78">
                  Review host proteins reported for the selected SARS-CoV-2 protein and open the matching interaction network.
                </p>
              </div>
              <button
                type="button"
                onClick={() => downloadCovidRows(selectedProtein, rows)}
                disabled={!rows.length}
                className="rounded-full bg-panel px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-white transition hover:bg-[#225c8f] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Download TSV
              </button>
            </div>

            {loading ? (
              <div className="px-5 py-8 text-sm text-ink/78">Loading Human-COVID-PPI table...</div>
            ) : error ? (
              <div className="px-5 py-8 text-sm text-crimson">{error}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left">
                  <thead className="bg-panel text-white">
                    <tr>
                      <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.2em]">Host accession</th>
                      <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.2em]">Gene symbol</th>
                      <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.2em]">Viral protein</th>
                      <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.2em]">Viral accession</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row) => (
                      <tr key={`${row.proteinA}-${row.Gene_Symbol}-${row.proteinB}`} className="border-b border-ink/12">
                        <td className="px-4 py-3 text-sm text-ink/84">{row.proteinA}</td>
                        <td className="px-4 py-3 text-sm text-ink">{row.Gene_Symbol}</td>
                        <td className="px-4 py-3 text-sm text-ink">{row.proteinB}</td>
                        <td className="px-4 py-3 text-sm text-ink/84">{row.Accession}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </PageFrame>
  );
}

export function ResultsPage({ jobId, navigate }) {
  const [job, setJob] = useState(null);
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const currentJob = await api.getJob(jobId);
        if (!active) {
          return;
        }
        setJob(currentJob);

        if (currentJob.status === "completed") {
          const resultPayload = await api.getResults(jobId);
          if (active) {
            setResults(resultPayload);
          }
        } else if (currentJob.status === "failed") {
          setError(currentJob.error || "DeepHPI did not complete this job.");
        }
      } catch (loadError) {
        if (active) {
          setError(loadError.message);
        }
      }
    }

    load();
    const timer = window.setInterval(load, 3000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [jobId]);

  const summaryItems = useMemo(() => {
    if (!results?.summary) {
      return [];
    }

    return [
      {
        label: "Predicted interactions",
        value: String(results.summary.interactionCount),
        note: "Positive host-pathogen pairs returned by the current DeepHPI threshold.",
      },
      {
        label: "Host proteins",
        value: String(results.summary.hostProteinCount),
        note: "Unique host proteins represented in the returned interaction set.",
      },
      {
        label: "Pathogen proteins",
        value: String(results.summary.pathogenProteinCount),
        note: "Unique pathogen proteins represented in the returned interaction set.",
      },
    ];
  }, [results]);

  return (
    <PageFrame
      eyebrow="Prediction report"
      title={`DeepHPI report for job ${jobId}`}
      detail=""
      actions={job ? <JobStatusPill status={job.status} /> : null}
      contentClassName="max-w-none"
      detailClassName="max-w-none"
      headerAlign="split"
    >
      {error ? (
        <div className="paper-panel atlas-ring rounded-[1.25rem] px-5 py-6 text-sm text-crimson">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr_0.85fr_0.85fr]">
        <div className="paper-panel atlas-ring rounded-[1.25rem] p-5">
          <h3 className="text-xl font-semibold text-ink">Run configuration</h3>
          <p className="mt-3 text-sm leading-7 text-ink/80">
            {job
              ? `Model family: ${job.model}. Prediction mode: ${job.feature}. Host sequences: ${job.hostSequenceCount} (${job.hostInputType || "protein"}). Pathogen sequences: ${job.pathogenSequenceCount} (${job.pathogenInputType || "protein"}).`
              : "Loading the DeepHPI job metadata..."}
          </p>

          {job?.status === "completed" ? (
            <RouteLink
              href={`/network/${jobId}`}
              navigate={navigate}
              className="mt-4 inline-flex items-center justify-center rounded-full bg-[#123a61] px-6 py-3 text-sm font-semibold !text-white transition hover:bg-[#1d5584]"
            >
              Open Network
            </RouteLink>
          ) : null}

          {job?.status === "running" || job?.status === "queued" ? (
            <p className="mt-4 text-sm leading-7 text-ink/74">
              {(job.stage || "The predictor is still running.") + " This report updates automatically."}
            </p>
          ) : null}
        </div>

        {summaryItems.length ? (
          summaryItems.map((item) => <StatCard key={item.label} {...item} />)
        ) : null}
      </div>

      {job?.status === "completed" && results ? <ResultsTable rows={results.rows} /> : null}
    </PageFrame>
  );
}

export function NetworkPage({ jobId, navigate }) {
  const [job, setJob] = useState(null);
  const [network, setNetwork] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let timer = null;

    async function load() {
      try {
        const currentJob = await api.getJob(jobId);
        if (!active) {
          return;
        }
        setJob(currentJob);

        if (currentJob.status === "completed") {
          const networkPayload = await api.getNetwork(jobId);
          if (active) {
            setNetwork(networkPayload);
          }
        } else if (currentJob.status === "failed") {
          setError(currentJob.error || "DeepHPI did not complete this job.");
        } else if (active) {
          timer = window.setTimeout(load, 3000);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError.message);
          timer = window.setTimeout(load, 3000);
        }
      }
    }

    load();

    return () => {
      active = false;
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [jobId]);

  return (
    <PageFrame
      eyebrow="Network atlas"
      title={`DeepHPI interaction atlas for job ${jobId}`}
      detail=""
      actions={
        <RouteLink
          href={`/results/${jobId}`}
          navigate={navigate}
          className="rounded-full border border-ink/14 bg-white px-4 py-3 font-mono text-[11px] uppercase tracking-[0.22em] text-ink/74 transition hover:border-cobalt/24"
        >
          Return to report
        </RouteLink>
      }
      contentClassName="max-w-none"
      detailClassName="max-w-none"
      headerAlign="split"
    >
      {error ? (
        <div className="paper-panel atlas-ring rounded-[1.25rem] px-5 py-6 text-sm text-crimson">
          {error}
        </div>
      ) : null}

      {job?.status !== "completed" ? (
        <InfoCard
          title="Waiting for completed results"
          body="The network page activates automatically once the DeepHPI report has finished and a graph can be assembled from the returned interaction set."
        />
      ) : null}

      {network?.nodes ? (
        <NetworkGraph nodes={network.nodes} edges={network.edges} interactions={network.interactions || []} />
      ) : null}
    </PageFrame>
  );
}

export function NotFoundPage({ navigate }) {
  return (
    <PageFrame
      eyebrow="Page not found"
      title="That DeepHPI page does not exist."
      detail="Use the navigation bar to return to the submission workspace or one of the dedicated report surfaces."
      actions={
        <RouteLink
          href="/submit"
          navigate={navigate}
          className="rounded-full bg-panel px-5 py-3 font-mono text-[11px] uppercase tracking-[0.22em] text-white transition hover:bg-[#225c8f]"
        >
          Open submission page
        </RouteLink>
      }
    />
  );
}
