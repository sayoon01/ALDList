export async function getDatasets() {
  const r = await fetch(`/api/datasets`);
  if (!r.ok) throw new Error(`getDatasets failed: ${r.status}`);
  return r.json();
}

export async function getPreview(datasetId: string, offset = 0, limit = 2000) {
  const r = await fetch(`/api/datasets/${datasetId}/preview?offset=${offset}&limit=${limit}`);
  if (!r.ok) throw new Error(`getPreview failed: ${r.status}`);
  return r.json();
}

export async function postStats(datasetId: string, body: any) {
  const r = await fetch(`/api/datasets/${datasetId}/stats`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`postStats failed: ${r.status}`);
  return r.json();
}
