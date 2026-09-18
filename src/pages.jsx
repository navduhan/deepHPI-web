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
  helpItems,
  helpSections,
  modelOptions,
  overviewStats,
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

function SummaryGrid({ items }) {
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <StatCard key={item.label} {...item} />
      ))}
    </div>
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
    <PageFrame
      eyebrow="DeepHPI webserver"
      title="Sequence-based host-pathogen interaction prediction."
      detail="Submit host and pathogen protein sequences, run DeepHPI with the appropriate biological model, review ranked interaction scores, and inspect the resulting interaction network."
      contentClassName="max-w-none"
      detailClassName="max-w-5xl"
      actions={
        <RouteLink
          href="/submit"
          navigate={navigate}
          className="rounded-full border border-panel bg-panel px-5 py-3 font-mono text-[11px] uppercase tracking-[0.22em] !text-white transition hover:border-cobalt hover:bg-cobalt"
        >
          Open submission page
        </RouteLink>
      }
    >
      <SummaryGrid items={overviewStats} />

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <InfoCard
          title="Prediction workflow"
          body="DeepHPI provides a dedicated submission page for FASTA input, a results page for ranked host-pathogen predictions, and a network view for inspecting interaction structure."
        />
        <InfoCard
          title="What you can analyze"
          body="DeepHPI supports plant-pathogen, human-bacteria, human-virus, and animal-pathogen prediction tasks, with optional pairwise restriction for focused screening."
        />
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <div className="paper-panel atlas-ring rounded-[1.25rem] p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-cobalt">Step 1</p>
          <h3 className="mt-3 text-xl font-semibold text-ink">Select a model family</h3>
          <p className="mt-2 text-sm leading-6 text-ink/78">
            Plant-pathogen, human-bacteria, human-virus, or animal-pathogen.
          </p>
        </div>
        <div className="paper-panel atlas-ring rounded-[1.25rem] p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-cobalt">Step 2</p>
          <h3 className="mt-3 text-xl font-semibold text-ink">Submit FASTA input</h3>
          <p className="mt-2 text-sm leading-6 text-ink/78">
            Provide host and pathogen protein sequences by upload or direct paste.
          </p>
        </div>
        <div className="paper-panel atlas-ring rounded-[1.25rem] p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-cobalt">Step 3</p>
          <h3 className="mt-3 text-xl font-semibold text-ink">Review ranked predictions</h3>
          <p className="mt-2 text-sm leading-6 text-ink/78">
            Inspect returned host-pathogen pairs with probability-based confidence scores.
          </p>
        </div>
        <div className="paper-panel atlas-ring rounded-[1.25rem] p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-cobalt">Step 4</p>
          <h3 className="mt-3 text-xl font-semibold text-ink">Explore the network</h3>
          <p className="mt-2 text-sm leading-6 text-ink/78">
            Open the dedicated network page to inspect interaction structure and node degree.
          </p>
        </div>
      </div>

      <ManuscriptCitation />
    </PageFrame>
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

export function HelpPage() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <PageFrame
      eyebrow="Help"
      title="Preparing input and reading DeepHPI results."
      detail="Use this page for FASTA formatting guidance, model selection notes, pairwise restriction input, and interpretation of ranked predictions and interaction networks."
      contentClassName="max-w-none"
      detailClassName="max-w-5xl"
    >
      <ServiceLimits />

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          {helpSections.map((section) => (
            <div key={section.title} className="paper-panel atlas-ring rounded-[1.25rem] p-5">
              <h3 className="text-xl font-semibold text-ink">{section.title}</h3>
              <p className="mt-3 text-sm leading-8 text-ink/80">{section.body}</p>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <div className="paper-panel atlas-ring rounded-[1.25rem] p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-cobalt">FAQ</p>
            <h3 className="mt-2 text-2xl font-semibold text-ink">Frequently asked questions</h3>
            <p className="mt-3 text-sm leading-7 text-ink/80">
              The questions below summarize the most common DeepHPI submission and interpretation issues.
            </p>
          </div>

        {helpItems.map((item, index) => {
          const open = openIndex === index;
          return (
            <div key={item.question} className="paper-panel atlas-ring rounded-[1.25rem] overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenIndex(open ? -1 : index)}
                className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left"
              >
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-cobalt">
                    DeepHPI guidance
                  </p>
                  <p className="mt-2 text-lg font-semibold text-ink">{item.question}</p>
                </div>
                <span className="rounded-full border border-ink/14 bg-white px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/80">
                  {open ? "Close" : "Open"}
                </span>
              </button>
              {open ? (
                <div className="border-t border-ink/12 px-5 py-5">
                  <p className="max-w-4xl text-sm leading-7 text-ink/80">{item.answer}</p>
                </div>
              ) : null}
            </div>
          );
        })}
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
