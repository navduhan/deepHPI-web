# deepHPI VM deployment

This deployment runs the Next.js application behind an unprivileged Nginx gateway on VM loopback
port 3220. Inputs are transferred over pinned-key SSH/SFTP to the configured cluster and submitted
as asynchronous SLURM jobs. The standalone Python worker writes result artifacts that are retrieved
only after SLURM reports successful completion.

## VM preparation

Install Docker Engine with Compose or rootless Podman with its external Compose provider, then clone
the repository. The recommended setup is the interactive deployment manager:

```bash
./start.sh
```

It creates `deploy/docker.env` with mode `0600`, validates all paths, limits, the SSH fingerprint,
and Compose configuration, builds the image, starts the services, and checks `/deepHPI`.

Available direct modes:

```bash
./start.sh --configure-only
./start.sh --start-only
./start.sh --update
./start.sh --rebuild
```

Use a dedicated restricted cluster account and private key. Verify the cluster ED25519 fingerprint
with the administrator through a separate trusted channel before configuring it. `ssh-keyscan` can
discover a key but does not establish trust by itself. Password authentication is not supported.

The cluster must privately provide the predictor source, environment, checkpoints, databases, and
the `deephpi.sl` script from the separate DeepHPI predictor installation. Do not place real cluster
identifiers or runtime assets in the public web repository.
The SLURM script contract is:

```text
deephpi.sl JOB_DIR MODEL FEATURE HOST_TYPE PATHOGEN_TYPE
```

## Rootless Podman

Run as an unprivileged user without `sudo`:

```bash
podman info --format '{{.Host.Security.Rootless}}'
podman compose --env-file deploy/docker.env \
  -f deploy/compose.yaml \
  -f deploy/compose.podman.yaml \
  up -d --build
```

The rootless check must print `true`. The Podman overlay uses `keep-id`, private SELinux relabeling,
and a read-only dedicated cluster key. Do not add `compose.ssh-key.yaml` to the Podman command.

## Docker Engine

```bash
docker compose --env-file deploy/docker.env \
  -f deploy/compose.yaml \
  -f deploy/compose.ssh-key.yaml \
  up -d --build
```

The gateway binds to `127.0.0.1:3220` by default. If the HTTPS reverse proxy is on another host,
bind only to the VM private interface, set `TRUSTED_PROXY_CIDR` to the proxy's exact source address,
and restrict port 3220 to that source at the firewall. Never expose the application container.

Check the deployment:

```bash
docker compose --env-file deploy/docker.env \
  -f deploy/compose.yaml \
  -f deploy/compose.ssh-key.yaml ps
docker compose --env-file deploy/docker.env \
  -f deploy/compose.yaml \
  -f deploy/compose.ssh-key.yaml logs -f app gateway
curl --fail http://127.0.0.1:3220/deepHPI
```

## Sequence and workload limits

The default accepts up to 500 host and 500 pathogen sequences, but evaluates no more than 10,000
pairs. Request size, combined residues, per-sequence length, and candidate-pair limits are enforced
independently. Larger two-sided inputs must provide a pairwise restriction or use an explicitly
reviewed higher ceiling.

## Results retention

Private results are retained for 30 days by default. The application removes expired completed or
failed jobs when accepting new work. The included cleanup script provides a second VM-side control:

```cron
17 3 * * * /absolute/path/to/deepHPI/deploy/prune-expired-jobs.sh
```

Install it in the crontab of the same unprivileged user that owns `deploy/data/jobs`, not root.
