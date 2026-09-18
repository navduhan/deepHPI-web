import { manuscriptCitation, serviceLimits } from "../content/siteContent";

export function ServiceLimits({ compact = false }) {
  return (
    <section className="paper-panel atlas-ring rounded-[1.35rem] p-4 md:p-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-cobalt">Submission limits</p>
          <h2 className={`${compact ? "mt-1 text-xl" : "mt-2 text-2xl"} font-semibold text-ink`}>
            Current limits for one prediction job
          </h2>
        </div>
        <p className="max-w-xl text-sm leading-6 text-ink/72">
          The full host-by-pathogen screen and an uploaded pairwise list are each limited to 10,000 candidate pairs.
        </p>
      </div>

      <div className={`mt-4 grid gap-2 ${compact ? "grid-cols-2 lg:grid-cols-3" : "grid-cols-2 md:grid-cols-3 xl:grid-cols-6"}`}>
        {serviceLimits.map((limit) => (
          <div key={limit.label} className="rounded-[0.95rem] border border-ink/12 bg-white px-3 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/62">{limit.label}</p>
            <p className="mt-2 text-xl font-semibold text-ink">{limit.value}</p>
            <p className="mt-1 text-xs leading-5 text-ink/68">{limit.note}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ManuscriptCitation({ compact = false }) {
  return (
    <section className="paper-panel atlas-ring rounded-[1.35rem] p-4 md:p-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-cobalt">Cite DeepHPI</p>
      <div className={`mt-3 ${compact ? "" : "md:flex md:items-end md:justify-between md:gap-6"}`}>
        <p className="max-w-4xl text-sm leading-7 text-ink/82">
          {manuscriptCitation.authors} <span className="font-semibold text-ink">{manuscriptCitation.title}</span>{" "}
          {manuscriptCitation.journal} DOI: {manuscriptCitation.doi}.
        </p>
        <div className={`flex flex-wrap gap-2 ${compact ? "mt-3" : "mt-3 shrink-0 md:mt-0"}`}>
          <a
            href={manuscriptCitation.doiUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-cobalt/24 bg-white px-4 py-2 text-sm font-semibold text-cobalt transition hover:border-cobalt hover:bg-cobalt/6"
          >
            View article
          </a>
          <a
            href={manuscriptCitation.pubmedUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-ink/14 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:border-panel/38"
          >
            PubMed
          </a>
        </div>
      </div>
    </section>
  );
}
