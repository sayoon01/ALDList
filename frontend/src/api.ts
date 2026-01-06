export const API_BASE = "http://localhost:8000/api";

export async function getDatasets() {
  const r = await fetch(`${API_BASE}/datasets`);
  return r.json();
}

export async function getPreview(datasetId: string, offset=0, limit=2000) {
  const r = await fetch(`${API_BASE}/datasets/${datasetId}/preview?offset=${offset}&limit=${limit}`);
  return r.json();
}

export async function getColumns(datasetId: string) {
  const r = await fetch(`${API_BASE}/datasets/${datasetId}/columns`);
  return r.json();
}

export async function postStats(datasetId: string, body: any) {
  const r = await fetch(`${API_BASE}/datasets/${datasetId}/stats`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}
