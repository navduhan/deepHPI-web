import { useMemo, useState } from "react";
import { demoByModel, featureOptions, modelOptions, serviceLimits } from "../content/siteContent";
import { api } from "../lib/api";
import TurnstileWidget from "./TurnstileWidget";
import { ManuscriptCitation } from "./ServiceInformation";

function countFastaBlocks(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith(">")).length;
}

function readLocalFile(file, onLoad) {
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => onLoad(String(reader.result || ""));
  reader.readAsText(file);
}

function FeatureCard({ option, active, onClick }) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-2.5 rounded-[0.9rem] border px-3 py-3 text-left transition ${
        active
          ? "border-cobalt bg-[#eef5fb] text-cobalt shadow-[inset_0_0_0_1px_rgba(34,95,153,0.08)]"
          : "border-ink/14 bg-white text-ink hover:border-cobalt/30"
      }`}
    >
      <input type="radio" name="prediction-mode" value={option.id} checked={active} onChange={onClick} className="h-4 w-4 shrink-0 accent-[#225f99]" />
      <span className="text-sm font-semibold">{option.label}</span>
    </label>
  );
}

function InputTypeSelector({ label, name, value, onChange }) {
  const options = [
    { id: "protein", shortLabel: "AA", label: "Amino acid" },
    { id: "nucleotide", shortLabel: "NT", label: "Nucleotide" },
  ];

  return (
    <fieldset className="min-w-0">
      <legend className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/55">{label}</legend>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {options.map((option) => (
          <label
            key={option.id}
            title={option.label}
            className={`flex cursor-pointer items-center justify-center gap-2 rounded-[0.8rem] border px-2 py-3 text-xs font-bold transition ${
              value === option.id
                ? "border-cobalt bg-[#eef5fb] text-cobalt"
                : "border-ink/14 bg-white text-ink hover:border-cobalt/30"
            }`}
          >
            <input type="radio" name={name} value={option.id} checked={value === option.id} onChange={() => onChange(option.id)} className="h-4 w-4 shrink-0 accent-[#225f99]" />
            <span>{option.shortLabel}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function AccessionFetcher({ tone, onLoad }) {
  const [database, setDatabase] = useState("uniprot");
  const [accessions, setAccessions] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchAccessions = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await api.fetchAccessions(accessions, database);
      onLoad(result.fasta);
      setAccessions("");
    } catch (fetchError) {
      setError(fetchError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-3 rounded-[0.9rem] border border-ink/12 bg-[#f5f7f8] p-3">
      <div className="grid gap-2 md:grid-cols-[120px_minmax(0,1fr)_auto]">
        <select value={database} onChange={(event) => setDatabase(event.target.value)} className="rounded-[0.75rem] border border-ink/14 bg-white px-3 py-2 text-sm outline-none">
          <option value="uniprot">UniProt</option>
          <option value="ncbi">NCBI Protein</option>
        </select>
        <input value={accessions} onChange={(event) => setAccessions(event.target.value)} className="rounded-[0.75rem] border border-ink/14 bg-white px-3 py-2 font-mono text-sm outline-none" placeholder="Accessions separated by spaces or commas" />
        <button type="button" disabled={loading || !accessions.trim()} onClick={fetchAccessions} className={`rounded-full px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50 ${tone === "pathogen" ? "bg-[#d46a57] hover:bg-[#bb5947]" : "bg-panel hover:bg-cobalt"}`}>
          {loading ? "Fetching..." : "Fetch"}
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-crimson">{error}</p> : null}
    </div>
  );
}

function SequencePanel({ value, onChange, onFileLoad, onAccessionLoad, placeholder, compact = false, tone = "host" }) {
  const toneClasses =
    tone === "pathogen"
      ? {
          border: "focus:border-[#d46a57]",
        }
      : {
          border: "focus:border-[#617b88]",
        };

  return (
    <div className="rounded-[1.1rem] border border-ink/14 bg-white p-3">
      <div className="flex flex-wrap gap-2">
        <label className={`cursor-pointer rounded-full px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white transition ${
          tone === "pathogen" ? "bg-[#d46a57] hover:bg-[#bf5947]" : "bg-panel hover:bg-cobalt"
        }`}>
          Upload FASTA
          <input
            type="file"
            accept=".fa,.faa,.fasta,.txt"
            className="hidden"
            onChange={(event) => readLocalFile(event.target.files?.[0], onFileLoad)}
          />
        </label>
        <span className="self-center text-sm text-ink/58">or paste FASTA below</span>
      </div>

      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-3 w-full rounded-[0.9rem] border border-ink/14 bg-white px-4 py-3 font-mono text-sm leading-6 text-ink outline-none transition focus:bg-white ${toneClasses.border} ${
          compact ? "min-h-[132px]" : "min-h-[164px]"
        }`}
        placeholder={placeholder}
      />
      <AccessionFetcher tone={tone} onLoad={onAccessionLoad} />
    </div>
  );
}

function HelpModal({ open, onClose }) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#102843]/45 px-4 py-6">
      <div className="paper-panel atlas-ring max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[1.5rem] p-5 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-cobalt">Submission help</p>
            <h3 className="mt-2 text-2xl font-semibold text-ink">Preparing a DeepHPI job</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-ink/14 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:border-panel/40"
          >
            Close
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-[1rem] border border-ink/12 bg-white px-4 py-4">
            <h4 className="text-base font-semibold text-ink">Required input</h4>
            <p className="mt-2 text-sm leading-7 text-ink/80">
              Provide host and pathogen FASTA sequences by paste, upload, or protein accession retrieval. DeepHPI counts one sequence for each FASTA record beginning with <code>&gt;</code>.
            </p>
          </div>
          <div className="rounded-[1rem] border border-ink/12 bg-white px-4 py-4">
            <h4 className="text-base font-semibold text-ink">Pairwise restriction</h4>
            <p className="mt-2 text-sm leading-7 text-ink/80">
              Optionally provide a two-column tab-separated list of host and pathogen accessions to limit the screening space.
            </p>
          </div>
          <div className="rounded-[1rem] border border-ink/12 bg-white px-4 py-4">
            <h4 className="text-base font-semibold text-ink">Model family</h4>
            <p className="mt-2 text-sm leading-7 text-ink/80">
              Select the biological system that matches your study: plant-pathogen, human-bacteria, human-virus, or animal-pathogen.
            </p>
          </div>
          <div className="rounded-[1rem] border border-ink/12 bg-white px-4 py-4">
            <h4 className="text-base font-semibold text-ink">Prediction mode</h4>
            <p className="mt-2 text-sm leading-7 text-ink/80">
              Use <strong>Sensitive</strong> for more exhaustive screening or <strong>Faster</strong> for quicker runs with a lighter descriptor profile.
            </p>
          </div>
        </div>

        <div className="mt-5 border-t border-ink/12 pt-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-cobalt">Submission limits</p>
          <h4 className="mt-2 text-xl font-semibold text-ink">Current limits for one prediction job</h4>
          <p className="mt-2 text-sm leading-6 text-ink/72">
            The full host-by-pathogen screen and an uploaded pairwise list are each limited to 10,000 candidate pairs.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3">
            {serviceLimits.map((limit) => (
              <div key={limit.label} className="rounded-[0.9rem] border border-ink/12 bg-white px-3 py-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/62">{limit.label}</p>
                <p className="mt-1 text-lg font-semibold text-ink">{limit.value}</p>
                <p className="mt-1 text-xs leading-5 text-ink/68">{limit.note}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SubmissionWorkspace({ navigate }) {
  const [model, setModel] = useState("PP");
  const [feature, setFeature] = useState("best");
  const [hostInputType, setHostInputType] = useState("protein");
  const [pathogenInputType, setPathogenInputType] = useState("protein");
  const [hostInput, setHostInput] = useState("");
  const [pathogenInput, setPathogenInput] = useState("");
  const [pairwiseInput, setPairwiseInput] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [loadedDemoModel, setLoadedDemoModel] = useState(null);

  const hostCount = useMemo(() => countFastaBlocks(hostInput), [hostInput]);
  const pathogenCount = useMemo(() => countFastaBlocks(pathogenInput), [pathogenInput]);
  const pairwiseCount = useMemo(
    () =>
      pairwiseInput
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean).length,
    [pairwiseInput],
  );

  const activeModel = modelOptions.find((item) => item.id === model);
  const activeFeature = featureOptions.find((item) => item.id === feature);

  const loadDemo = () => {
    const demo = demoByModel[model];
    setHostInput(demo.host);
    setPathogenInput(demo.pathogen);
    setHostInputType("protein");
    setPathogenInputType("protein");
    setPairwiseInput("");
    setLoadedDemoModel(model);
    setError("");
  };

  const changeModel = (nextModel) => {
    if (loadedDemoModel && loadedDemoModel !== nextModel) {
      setHostInput("");
      setPathogenInput("");
      setPairwiseInput("");
      setLoadedDemoModel(null);
    }
    setModel(nextModel);
  };

  const changeHostInput = (value) => {
    setHostInput(value);
    setHostInputType("protein");
    setLoadedDemoModel(null);
  };

  const changePathogenInput = (value) => {
    setPathogenInput(value);
    setPathogenInputType("protein");
    setLoadedDemoModel(null);
  };

  const clearForm = () => {
    setHostInput("");
    setPathogenInput("");
    setPairwiseInput("");
    setError("");
    setHostInputType("protein");
    setPathogenInputType("protein");
    setLoadedDemoModel(null);
    setTurnstileToken("");
    setTurnstileResetKey((value) => value + 1);
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!hostInput.trim() || !pathogenInput.trim()) {
      setError("Both host and pathogen FASTA inputs are required.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await api.submitJob({
        hostInput,
        pathogenInput,
        pairwiseInput,
        model,
        feature,
        hostInputType,
        pathogenInputType,
        turnstileToken,
      });
      navigate(`/results/${response.jobId}`);
    } catch (submissionError) {
      setError(submissionError.message);
      setTurnstileToken("");
      setTurnstileResetKey((value) => value + 1);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <HelpModal open={showHelp} onClose={() => setShowHelp(false)} />

      <section className="paper-panel atlas-ring relative overflow-hidden rounded-[1.5rem] border-l-4 border-l-cobalt px-5 py-4 md:px-6 md:py-5">
        <div className="relative flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-cobalt">Prediction workspace</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-ink md:text-3xl">New DeepHPI prediction</h1>
          </div>
          <p className="max-w-xl text-sm leading-6 text-ink/62">Add both sequence sets, choose the matching model, and submit one prediction job.</p>
        </div>
      </section>

      <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <section className="paper-panel atlas-ring rounded-[1.5rem] p-4 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-cobalt">01 / Input</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-ink">Host and pathogen sequences</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={loadDemo} className="rounded-full bg-panel px-4 py-2 text-xs font-bold text-white transition hover:bg-cobalt">
                  Load {activeModel?.tag} demo
                </button>
                <button type="button" onClick={() => setShowHelp(true)} className="rounded-full border border-ink/14 bg-white px-4 py-2 text-xs font-bold text-ink transition hover:border-cobalt/35" aria-label="Open submission guide and limits">
                  ⓘ Guide & limits
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <div className="rounded-[1.1rem] border border-ink/12 border-t-[3px] border-t-cobalt bg-white p-3 md:p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-ink">Host FASTA</h3>
                  <span className="font-mono text-[11px] font-bold text-cobalt">{hostCount} sequence{hostCount === 1 ? "" : "s"}</span>
                </div>
                <div className="mt-2">
                  <SequencePanel value={hostInput} onChange={(value) => { setHostInput(value); setLoadedDemoModel(null); }} onFileLoad={changeHostInput} onAccessionLoad={changeHostInput} placeholder=">host_protein_1" compact tone="host" />
                </div>
              </div>

              <div className="rounded-[1.1rem] border border-ink/12 border-t-[3px] border-t-[#d46a57] bg-white p-3 md:p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-ink">Pathogen FASTA</h3>
                  <span className="font-mono text-[11px] font-bold text-[#c85a45]">{pathogenCount} sequence{pathogenCount === 1 ? "" : "s"}</span>
                </div>
                <div className="mt-2">
                  <SequencePanel value={pathogenInput} onChange={(value) => { setPathogenInput(value); setLoadedDemoModel(null); }} onFileLoad={changePathogenInput} onAccessionLoad={changePathogenInput} placeholder=">pathogen_protein_1" compact tone="pathogen" />
                </div>
              </div>
            </div>
          </section>

          <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(350px,0.65fr)]">
          <section className="paper-panel atlas-ring flex h-full flex-col rounded-[1.5rem] p-4 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="inline-flex rounded-full border border-cobalt/20 bg-[#eef5fb] px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-cobalt">Optional</span>
                <h2 className="mt-2 text-xl font-semibold text-ink">Pairwise restriction</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-ink/65">{pairwiseCount} pairs</span>
                <label className="cursor-pointer rounded-full border border-ink/14 bg-white px-4 py-2 text-xs font-bold text-ink transition hover:border-cobalt/35">
                  Upload list
                  <input type="file" accept=".tsv,.txt,.tab" className="hidden" onChange={(event) => readLocalFile(event.target.files?.[0], setPairwiseInput)} />
                </label>
              </div>
            </div>
            <p className="mt-2 text-sm leading-6 text-ink/65">Leave blank to screen all submitted combinations, or provide tab-separated host and pathogen identifiers.</p>
            <textarea value={pairwiseInput} onChange={(event) => setPairwiseInput(event.target.value)} className="mt-3 min-h-[150px] w-full flex-1 rounded-[0.9rem] border border-ink/14 bg-white px-4 py-3 font-mono text-sm leading-6 text-ink outline-none transition focus:border-cobalt" placeholder={"host_protein_1\tpathogen_protein_1"} />

            <fieldset className="mt-4 border-t border-ink/12 pt-4">
              <legend className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink/58">Model family</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {modelOptions.map((option) => (
                  <label
                    key={option.id}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-[0.85rem] border px-3 py-3 text-left text-sm font-semibold transition ${
                      model === option.id
                        ? "border-cobalt bg-[#eef5fb] text-cobalt shadow-[inset_0_0_0_1px_rgba(34,95,153,0.08)]"
                        : "border-ink/14 bg-white text-ink hover:border-cobalt/30"
                    }`}
                  >
                    <input type="radio" name="model-family" value={option.id} checked={model === option.id} onChange={() => changeModel(option.id)} className="h-4 w-4 shrink-0 accent-[#225f99]" />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </section>

        <aside className="min-w-0">
          <section className="paper-panel atlas-ring flex h-full flex-col rounded-[1.5rem] p-4 md:p-5">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-cobalt">02 / Configuration</p>
            <h2 className="mt-1 text-xl font-semibold text-ink">Prediction settings</h2>

            <div className="mt-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">Prediction mode</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {featureOptions.map((option) => <FeatureCard key={option.id} option={option} active={feature === option.id} onClick={() => setFeature(option.id)} />)}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-ink/12 pt-4">
              <InputTypeSelector label="Host type" name="host-input-type" value={hostInputType} onChange={setHostInputType} />
              <InputTypeSelector label="Pathogen type" name="pathogen-input-type" value={pathogenInputType} onChange={setPathogenInputType} />
            </div>
            <div className="mt-auto border-t border-ink/12 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-cobalt">03 / Run</p>
                <h2 className="mt-1 text-xl font-semibold text-ink">Review & submit</h2>
              </div>
              <span className="rounded-full border border-ink/12 bg-white px-3 py-1.5 font-mono text-[10px] text-ink/68">{activeModel?.tag} · {activeFeature?.label}</span>
            </div>
            <p className="mt-3 text-sm text-ink/68">{hostCount} host × {pathogenCount} pathogen{pairwiseCount ? ` · ${pairwiseCount} selected pairs` : ""}</p>
            {error ? <div className="mt-3 rounded-[0.9rem] border border-[#c85a45]/25 bg-[#fff0ec] px-4 py-3 text-sm text-[#8e3f31]" role="alert">{error}</div> : null}
            <div className="mt-4">
              <TurnstileWidget siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ""} onToken={setTurnstileToken} resetKey={turnstileResetKey} />
              <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
                <button type="button" onClick={clearForm} className="rounded-full border border-ink/16 bg-white px-5 py-3.5 text-sm font-bold text-ink transition hover:border-ink/35">Clear</button>
                <button type="submit" disabled={submitting} className="w-full rounded-full bg-panel px-5 py-3.5 text-sm font-bold text-white transition hover:bg-cobalt disabled:cursor-not-allowed disabled:opacity-60">
                  {submitting ? "Submitting prediction..." : "Run prediction"}
                </button>
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-ink/55">A private results link is created when the job is accepted.</p>
            </div>
          </section>
        </aside>
          </div>
      </form>

      <div className="mt-4">
        <ManuscriptCitation compact />
      </div>
    </>
  );
}
