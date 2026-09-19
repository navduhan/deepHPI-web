# deepHPI-web

This repository contains only the DeepHPI Next.js website, secured API gateway, and deployment
configuration. The prediction program is maintained separately in the sibling `deepHPI/`
directory and is installed independently on the HPC. The existing interface, page structure,
result table, and network viewer are retained. Public requests terminate at the Next.js API; the
HPC does not expose a web port.

## Architecture

1. Next.js validates the request, applies rate and capacity limits, verifies Turnstile, and creates
   a private job token.
2. A dedicated SSH key and pinned host fingerprint are used to create a private HPC workspace and
   submit the configured `deepHPI/deephpi.sl` script.
3. SLURM runs `deepHPI/deephpi.sl` from the separate predictor installation. Its isolated worker
   writes JSON result artifacts.
4. Status requests query SLURM. Completed results are copied into the private web job record and the
   remote workspace is removed.

## Local web development

```bash
npm install
npm run dev
```

The job submission endpoint requires the cluster environment variables. UI pages, bundled datasets,
input validation, and accession retrieval can be tested without submitting a cluster job.

```bash
npm run lint
npm run build
```

## Separate predictor installation

Install the sibling `deepHPI/` directory on the cluster. It contains the command-line predictor,
SLURM entrypoint, isolated worker, Python environment specification, checkpoints, DIAMOND database,
and annotation table. Configure the cluster environment without placing real usernames, hosts,
keys, or filesystem paths in this web repository:

```bash
export DEEPHPI_APP_ROOT=/private/installation/path
export DEEPHPI_PYTHON_BIN=/private/environment/path/bin/python
```

Configure `BIOCLUSTER_REMOTE_SCRIPT` to the installed `deepHPI/deephpi.sl`. Its contract is:

```text
deephpi.sl JOB_DIR MODEL FEATURE HOST_TYPE PATHOGEN_TYPE
```

The website and prediction installation do not share a process, environment, or writable directory.

## Container deployment

Use the deployment manager from the repository root:

```bash
./start.sh
```

It provides the same setup, configure-only, start-only, update, and clean-rebuild modes used by the
sibling predictor services, with Docker and rootless Podman overlays. See `deploy/README.md`.

The deployment uses a read-only Next.js container, a private writable job volume, a read-only SSH
key mount, an unprivileged Nginx gateway, dropped Linux capabilities, request-size limits, and
separate internal and egress networks.

## Input and job controls

- Separate host and pathogen accession retrieval from UniProt or NCBI Protein.
- Protein and nucleotide alphabets validated according to the selected input type.
- Duplicate identifiers, empty records, excessive sequences, residues, and candidate pairs rejected.
- Up to 500 host and 500 pathogen sequences are accepted per job by default. No more than 10,000
  pairs are evaluated unless the deployment administrator explicitly raises the pair ceiling.
- Pairwise rows must reference identifiers present in the submitted FASTA files.
- Model, mode, job ID, and accession values are allow-listed or strictly validated.
- Status, result, and network endpoints require an unguessable private job token.
- Each model family has its own demo sequence set. Changing the model after loading a demo clears the
  old sequences so they cannot be submitted under another model accidentally.

## Web repository layout

- `src/app/`: Next.js pages and secured API routes
- `src/lib/`: request validation, private job records, SSH/SLURM integration
- `deploy/`: container, Nginx, and environment templates
- `public/`: unchanged images and bundled static datasets

Prediction code, checkpoints, databases, job files, deployment secrets, and real cluster identifiers
are not part of the web container.
