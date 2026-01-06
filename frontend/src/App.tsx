import React, { useEffect, useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

import { getDatasets, getPreview, getColumns, postStats } from "./api";

type Dataset = {
  dataset_id: string;
  filename: string;
  path: string;
  size_bytes: number;
  mtime: number;
  columns: string[];
};

export default function App() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [datasetId, setDatasetId] = useState<string>("");
  const [rowData, setRowData] = useState<any[]>([]);
  const [columnDefs, setColumnDefs] = useState<any[]>([]);
  const [allColumns, setAllColumns] = useState<string[]>([]);

  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [start, setStart] = useState<number>(0);
  const [end, setEnd] = useState<number>(1000);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const j = await getDatasets();
        console.log("Datasets loaded:", j);
        setDatasets(j.datasets || []);
        if (j.datasets?.length) setDatasetId(j.datasets[0].dataset_id);
      } catch (error) {
        console.error("Failed to load datasets:", error);
      }
    })();
  }, []);

  useEffect(() => {
    if (!datasetId) return;
    (async () => {
      try {
        const cols = await getColumns(datasetId);
        console.log("Columns loaded:", cols);
        setAllColumns(cols.columns || []);

        const preview = await getPreview(datasetId, 0, 2000);
        console.log("Preview loaded:", preview);
        setRowData(preview.data || []);

        // grid columns는 preview data의 key 기반으로 생성(데이터 바뀌어도 자동)
        const keys = preview.data?.[0] ? Object.keys(preview.data[0]) : (cols.columns || []);
        setColumnDefs(keys.map((k: string) => ({ field: k, filter: true, sortable: true, resizable: true })));
      } catch (error) {
        console.error("Failed to load data:", error);
      }
    })();
  }, [datasetId]);

  async function runStats() {
    if (!datasetId || selectedColumns.length === 0) return;
    const body = {
      columns: selectedColumns,
      row_range: { start, end },
      metrics: ["avg", "max"], // 여기서 min,count,std 같은 확장 쉬움
    };
    const j = await postStats(datasetId, body);
    setStats(j);
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr 360px", height: "100vh" }}>
      {/* Left: dataset + column chooser */}
      <div style={{ padding: 12, borderRight: "1px solid #ddd", overflow: "auto" }}>
        <h3>Datasets</h3>
        <select value={datasetId} onChange={(e) => setDatasetId(e.target.value)} style={{ width: "100%" }}>
          {datasets.map((d) => (
            <option key={d.dataset_id} value={d.dataset_id}>
              {d.filename}
            </option>
          ))}
        </select>

        <h3 style={{ marginTop: 16 }}>Columns ({allColumns.length})</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setSelectedColumns(allColumns.slice(0, 5))}>Pick 5</button>
          <button onClick={() => setSelectedColumns([])}>Clear</button>
        </div>

        <div style={{ marginTop: 8 }}>
          <input
            placeholder="(필요하면 검색 기능 추가)"
            style={{ width: "100%", padding: 6 }}
            disabled
          />
        </div>

        <div style={{ marginTop: 8, maxHeight: 380, overflow: "auto", border: "1px solid #eee" }}>
          {allColumns.map((c) => {
            const checked = selectedColumns.includes(c);
            return (
              <label key={c} style={{ display: "block", padding: "4px 8px" }}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedColumns([...selectedColumns, c]);
                    else setSelectedColumns(selectedColumns.filter((x) => x !== c));
                  }}
                />{" "}
                {c}
              </label>
            );
          })}
        </div>

        <h3 style={{ marginTop: 16 }}>Row Range</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="number" value={start} onChange={(e) => setStart(Number(e.target.value))} style={{ width: "50%" }} />
          <input type="number" value={end} onChange={(e) => setEnd(Number(e.target.value))} style={{ width: "50%" }} />
        </div>

        <button onClick={runStats} style={{ marginTop: 12, width: "100%", padding: 10 }}>
          Avg/Max 계산
        </button>
      </div>

      {/* Middle: grid */}
      <div className="ag-theme-alpine" style={{ width: "100%", height: "100%" }}>
        <AgGridReact rowData={rowData} columnDefs={columnDefs} />
      </div>

      {/* Right: stats */}
      <div style={{ padding: 12, borderLeft: "1px solid #ddd", overflow: "auto" }}>
        <h3>Stats</h3>
        {!stats ? (
          <div>컬럼 선택 + row 범위 넣고 계산 눌러.</div>
        ) : (
          <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(stats, null, 2)}</pre>
        )}
      </div>
    </div>
  );
}
