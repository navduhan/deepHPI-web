import { Client, type SFTPWrapper } from "ssh2";
import { DEEPHPI_CONFIG, getSSHAuthOptions } from "./config";

const quote = (value: string) => `'${value.replace(/'/g, `'"'"'`)}'`;

function connect() {
  return new Promise<Client>((resolve, reject) => {
    const client = new Client();
    client.once("ready", () => resolve(client));
    client.once("error", reject);
    client.connect(getSSHAuthOptions());
  });
}

function execRemote(client: Client, command: string) {
  return new Promise<string>((resolve, reject) => {
    client.exec(command, (error, stream) => {
      if (error) return reject(error);
      let stdout = "";
      let stderr = "";
      stream.on("data", (data: Buffer) => { stdout += data.toString(); });
      stream.stderr.on("data", (data: Buffer) => { stderr += data.toString(); });
      stream.on("close", (code: number | null) => code === 0 ? resolve(stdout.trim()) : reject(new Error(stderr.trim() || `Remote command failed with exit code ${code}.`)));
    });
  });
}

function openSftp(client: Client) {
  return new Promise<SFTPWrapper>((resolve, reject) => client.sftp((error, sftp) => error ? reject(error) : resolve(sftp)));
}

function writeRemote(sftp: SFTPWrapper, remotePath: string, content: string) {
  return new Promise<void>((resolve, reject) => sftp.writeFile(remotePath, Buffer.from(content), { mode: 0o600 }, (error) => error ? reject(error) : resolve()));
}

function readRemote(sftp: SFTPWrapper, remotePath: string) {
  return new Promise<string>((resolve, reject) => sftp.readFile(remotePath, (error, data) => error ? reject(error) : resolve(data.toString())));
}

export async function submitClusterJob(input: {
  jobId: string;
  hostInput: string;
  pathogenInput: string;
  pairwiseInput: string;
  model: string;
  feature: string;
  hostInputType: string;
  pathogenInputType: string;
}) {
  const client = await connect();
  let sftp: SFTPWrapper | undefined;
  const remoteDir = `${DEEPHPI_CONFIG.cluster.remoteTmpDir.replace(/\/$/, "")}/${input.jobId}`;
  try {
    await execRemote(client, `umask 077; mkdir -p -- ${quote(remoteDir)}; chmod 700 -- ${quote(remoteDir)}`);
    sftp = await openSftp(client);
    await writeRemote(sftp, `${remoteDir}/host.fasta`, `${input.hostInput.trim()}\n`);
    await writeRemote(sftp, `${remoteDir}/pathogen.fasta`, `${input.pathogenInput.trim()}\n`);
    if (input.pairwiseInput.trim()) await writeRemote(sftp, `${remoteDir}/pairwise.tsv`, `${input.pairwiseInput.trim()}\n`);
    const command = [
      "umask 077; sbatch --parsable",
      `--chdir=${quote(remoteDir)}`,
      `--output=${quote(`${remoteDir}/slurm-%j.out`)}`,
      `--error=${quote(`${remoteDir}/slurm-%j.err`)}`,
      quote(DEEPHPI_CONFIG.cluster.remoteScript),
      quote(remoteDir),
      quote(input.model),
      quote(input.feature),
      quote(input.hostInputType),
      quote(input.pathogenInputType),
    ].join(" ");
    const response = await execRemote(client, command);
    const clusterJobId = response.match(/^(\d+)/)?.[1];
    if (!clusterJobId) throw new Error("SLURM did not return a valid job ID.");
    return { clusterJobId, remoteDir };
  } catch (error) {
    await execRemote(client, `rm -rf -- ${quote(remoteDir)}`).catch(() => {});
    throw error;
  } finally {
    sftp?.end();
    client.end();
  }
}

export async function inspectClusterJob(clusterJobId: string, remoteDir: string) {
  if (!/^\d+$/.test(clusterJobId)) throw new Error("Invalid SLURM job identifier.");
  const client = await connect();
  let sftp: SFTPWrapper | undefined;
  try {
    let state = (await execRemote(client, `squeue -h -j ${clusterJobId} -o %T`)).split(/\s+/)[0] || "";
    if (!state) {
      const accounting = await execRemote(client, `sacct -n -X -j ${clusterJobId} --format=State`).catch(() => "");
      state = accounting.trim().split(/\s+/)[0]?.replace(/\+.*/, "") || "UNKNOWN";
    }
    const normalized = state.toUpperCase();
    const activeStates = new Set(["PENDING", "CONFIGURING", "RUNNING", "COMPLETING", "RESIZING", "SUSPENDED"]);
    if (activeStates.has(normalized)) return { status: normalized === "PENDING" || normalized === "CONFIGURING" ? "queued" : "running", state: normalized } as const;
    if (normalized !== "COMPLETED") {
      sftp = await openSftp(client);
      const workerStatus = await readRemote(sftp, `${remoteDir}/worker-status.json`).then(JSON.parse).catch(() => null);
      return { status: "failed", state: normalized, error: workerStatus?.error || `SLURM job ended with state ${normalized}.` } as const;
    }
    sftp = await openSftp(client);
    const [resultText, networkText, statusText] = await Promise.all([
      readRemote(sftp, `${remoteDir}/results.json`),
      readRemote(sftp, `${remoteDir}/network.json`),
      readRemote(sftp, `${remoteDir}/worker-status.json`),
    ]);
    return { status: "completed", state: normalized, results: JSON.parse(resultText), network: JSON.parse(networkText), workerStatus: JSON.parse(statusText) } as const;
  } finally {
    sftp?.end();
    client.end();
  }
}

export async function cleanupRemoteJob(remoteDir: string) {
  const root = DEEPHPI_CONFIG.cluster.remoteTmpDir.replace(/\/$/, "");
  if (!remoteDir.startsWith(`${root}/deephpi_`)) return;
  const client = await connect();
  try { await execRemote(client, `rm -rf -- ${quote(remoteDir)}`); } finally { client.end(); }
}
