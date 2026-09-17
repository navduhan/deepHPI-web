const API_BASE = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");

function jobToken(jobId) {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(`deephpi-job-token:${jobId}`) || "";
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const raw = await response.text();
  let data = null;

  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = { error: raw || "Unexpected response from DeepHPI." };
  }

  if (!response.ok) {
    throw new Error(data?.error || "Request failed.");
  }

  return data;
}

export const api = {
  async submitJob(payload) {
    const result = await request("/api/jobs", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (result?.jobId && result?.jobToken && typeof window !== "undefined") {
      window.localStorage.setItem(`deephpi-job-token:${result.jobId}`, result.jobToken);
    }
    return result;
  },
  getJob(jobId) {
    return request(`/api/jobs/${jobId}`, { headers: { "X-DeepHPI-Job-Token": jobToken(jobId) } });
  },
  getResults(jobId) {
    return request(`/api/jobs/${jobId}/results`, { headers: { "X-DeepHPI-Job-Token": jobToken(jobId) } });
  },
  getNetwork(jobId) {
    return request(`/api/jobs/${jobId}/network`, { headers: { "X-DeepHPI-Job-Token": jobToken(jobId) } });
  },
  fetchAccessions(accessions, db) {
    return request("/api/accession", { method: "POST", body: JSON.stringify({ accessions, db }) });
  },
};
