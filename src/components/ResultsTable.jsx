import { useMemo, useState } from "react";

function downloadRows(rows) {
  const header = [
    "Row",
    "Host Protein",
    "Host Hit",
    "Host Description",
    "Host Organism",
    "Host GO",
    "Host Sequence",
    "Pathogen Protein",
    "Pathogen Hit",
    "Pathogen Description",
    "Pathogen Organism",
    "Pathogen GO",
    "Pathogen Sequence",
    "Confidence Score",
  ];
  const body = rows.map((row) =>
    [
      row.Row,
      row["Host Protein"],
      row["Host Hit"] || "",
      row["Host Description"] || "",
      row["Host Organism"] || "",
      row["Host GO"] || "",
      row["Host Sequence"],
      row["Pathogen Protein"],
      row["Pathogen Hit"] || "",
      row["Pathogen Description"] || "",
      row["Pathogen Organism"] || "",
      row["Pathogen GO"] || "",
      row["Pathogen Sequence"],
      row["Confidence Score"],
    ].join("\t"),
  );
  const blob = new Blob([[header.join("\t"), ...body].join("\n")], { type: "text/tab-separated-values" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "DeepHPI-results.tsv";
  link.click();
  URL.revokeObjectURL(url);
}

export function ResultsTable({ rows }) {
  const [activeRow, setActiveRow] = useState(null);

  const sortedRows = useMemo(
    () =>
      [...rows].sort(
        (left, right) =>
          Number(right["Confidence Score"] || 0) - Number(left["Confidence Score"] || 0),
      ),
    [rows],
  );

  const goPreview = (value) => {
    if (!value) {
      return "no GO";
    }
    const terms = value
      .split(";")
      .map((term) => term.trim())
      .filter(Boolean);
    if (terms.length <= 3) {
      return terms.join("; ");
    }
    return `${terms.slice(0, 3).join("; ")} ...`;
  };

  if (!sortedRows.length) {
    return (
      <div className="paper-panel atlas-ring rounded-[1.8rem] p-8 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-ink/58">Results</p>
        <h3 className="mt-3 text-2xl font-semibold text-ink">No positive interactions were returned</h3>
        <p className="mt-3 text-sm leading-7 text-ink/80">
          DeepHPI completed the submitted run and no host-pathogen pairs crossed the current
          positive threshold.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="paper-panel atlas-ring rounded-[1.8rem] overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/12 px-5 py-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-ink/58">Ranked interactions</p>
            <p className="mt-1 text-sm text-ink/78">
              Sorted by DeepHPI confidence score across the predicted positive interaction set.
            </p>
          </div>
          <button
            type="button"
            onClick={() => downloadRows(sortedRows)}
            className="rounded-full bg-panel px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-white transition hover:bg-[#223552]"
          >
            Download TSV
          </button>
        </div>

        <div className="max-h-[520px] overflow-auto">
          <table className="min-w-full border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-panel text-white">
              <tr>
                <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.2em]">Rank</th>
                <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.2em]">Host protein</th>
                <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.2em]">Host SwissProt</th>
                <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.2em]">Host GO</th>
                <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.2em]">Pathogen protein</th>
                <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.2em]">Pathogen SwissProt</th>
                <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.2em]">Pathogen GO</th>
                <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.2em]">Confidence</th>
                <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.2em]">Sequences</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row, index) => (
                <tr key={`${row["Host Protein"]}-${row["Pathogen Protein"]}`} className="border-b border-ink/12">
                  <td className="px-4 py-3 text-sm text-ink/84">{index + 1}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-ink">{row["Host Protein"]}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-ink/80">
                    {row["Host Hit"] && row["Host Hit"] !== "no hit" ? (
                      <a
                        href={`https://www.uniprot.org/uniprot/${row["Host Hit"]}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-cobalt"
                      >
                        {row["Host Hit"]}
                      </a>
                    ) : (
                      "no hit"
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-ink/80">
                    <div className="max-w-[18rem]" title={row["Host GO"] || ""}>
                      {goPreview(row["Host GO"])}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-ink">{row["Pathogen Protein"]}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-ink/80">
                    {row["Pathogen Hit"] && row["Pathogen Hit"] !== "no hit" ? (
                      <a
                        href={`https://www.uniprot.org/uniprot/${row["Pathogen Hit"]}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-cobalt"
                      >
                        {row["Pathogen Hit"]}
                      </a>
                    ) : (
                      "no hit"
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-ink/80">
                    <div className="max-w-[18rem]" title={row["Pathogen GO"] || ""}>
                      {goPreview(row["Pathogen GO"])}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-cobalt/18 bg-cobalt/8 px-3 py-2 font-mono text-xs text-cobalt">
                      {Number(row["Confidence Score"] || 0).toFixed(4)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setActiveRow(row)}
                      className="rounded-full border border-cobalt/24 bg-white px-4 py-2 text-xs font-semibold text-cobalt transition hover:border-cobalt hover:bg-cobalt/6"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {activeRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1e31]/45 p-4">
          <div className="paper-panel atlas-ring max-h-[88vh] w-full max-w-5xl overflow-auto rounded-[1.75rem] p-5 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-cobalt">Sequence viewer</p>
                <h3 className="mt-2 text-2xl font-semibold text-ink">
                  {activeRow["Host Protein"]} and {activeRow["Pathogen Protein"]}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveRow(null)}
                className="rounded-full border border-ink/14 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:border-cobalt/24"
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-2">
              <div className="rounded-[1.25rem] border border-ink/14 bg-white p-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-cobalt">Host annotation</p>
                <p className="mt-2 text-sm text-ink/80">
                  Hit: {activeRow["Host Hit"] || "no hit"}
                </p>
                {activeRow["Host Description"] ? <p className="mt-2 text-sm leading-6 text-ink/80">{activeRow["Host Description"]}</p> : null}
                {activeRow["Host Organism"] ? <p className="mt-2 text-sm text-ink/70">{activeRow["Host Organism"]}</p> : null}
                {activeRow["Host GO"] ? <p className="mt-2 break-all text-xs leading-6 text-ink/70">{activeRow["Host GO"]}</p> : null}
              </div>

              <div className="rounded-[1.25rem] border border-ink/14 bg-white p-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-cobalt">Pathogen annotation</p>
                <p className="mt-2 text-sm text-ink/80">
                  Hit: {activeRow["Pathogen Hit"] || "no hit"}
                </p>
                {activeRow["Pathogen Description"] ? <p className="mt-2 text-sm leading-6 text-ink/80">{activeRow["Pathogen Description"]}</p> : null}
                {activeRow["Pathogen Organism"] ? <p className="mt-2 text-sm text-ink/70">{activeRow["Pathogen Organism"]}</p> : null}
                {activeRow["Pathogen GO"] ? <p className="mt-2 break-all text-xs leading-6 text-ink/70">{activeRow["Pathogen GO"]}</p> : null}
              </div>

              <div className="rounded-[1.25rem] border border-ink/14 bg-white p-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-cobalt">Host sequence</p>
                <p className="mt-2 text-base font-semibold text-ink">{activeRow["Host Protein"]}</p>
                <pre className="mt-4 overflow-auto whitespace-pre-wrap break-all rounded-[1rem] bg-paper px-4 py-4 font-mono text-xs leading-6 text-ink">
                  {activeRow["Host Sequence"]}
                </pre>
              </div>

              <div className="rounded-[1.25rem] border border-ink/14 bg-white p-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-cobalt">Pathogen sequence</p>
                <p className="mt-2 text-base font-semibold text-ink">{activeRow["Pathogen Protein"]}</p>
                <pre className="mt-4 overflow-auto whitespace-pre-wrap break-all rounded-[1rem] bg-paper px-4 py-4 font-mono text-xs leading-6 text-ink">
                  {activeRow["Pathogen Sequence"]}
                </pre>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
