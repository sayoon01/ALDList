import React, { useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type { CellMouseDownEvent, CellMouseOverEvent, GridApi } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

import { getDatasets, getPreview, postStats } from "./api";

type Dataset = {
  dataset_id: string;
  path: string;
  filename: string;
  size_bytes: number;
  mtime: number;
  columns: string[];
};

export default function App() {
  const gridApiRef = useRef<GridApi | null>(null);

  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [datasetId, setDatasetId] = useState<string>("");

  const [allColumns, setAllColumns] = useState<string[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);

  const [rowData, setRowData] = useState<any[]>([]);
  const [columnDefs, setColumnDefs] = useState<any[]>([]);

  // row range는 [start, end)
  const [start, setStart] = useState<number>(0);
  const [end, setEnd] = useState<number>(1000);

  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState<string>("");

  // 드래그로 row range 잡기 위한 상태
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [dragStartRow, setDragStartRow] = useState<number | null>(null);

  // 초기: dataset 목록 로드
  useEffect(() => {
    (async () => {
      try {
        const j = await getDatasets();
        setDatasets(j.datasets);
        if (j.datasets?.length) setDatasetId(j.datasets[0].dataset_id);
      } catch (e: any) {
        setError(String(e?.message ?? e));
      }
    })();
  }, []);

  // dataset 변경: preview 로드 + columns 로드
  useEffect(() => {
    if (!datasetId) return;
    (async () => {
      try {
        setError("");
        setStats(null);
        setSelectedColumns([]);

        const preview = await getPreview(datasetId, 0, 2000);
        setRowData(preview.data ?? []);

        // columns는 preview 응답에 포함되어 있음
        setAllColumns(preview.columns ?? []);

        // 그리드 컬럼 생성
        const keys = preview.data?.[0] ? Object.keys(preview.data[0]) : (preview.columns ?? []);
        setColumnDefs(keys.map((k: string) => ({
          field: k,
          filter: true,
          sortable: true,
          resizable: true,
        })));
      } catch (e: any) {
        setError(String(e?.message ?? e));
      }
    })();
  }, [datasetId]);

  const gridOptions = useMemo(() => {
    return {
      rowSelection: "multiple" as const,
      suppressRowClickSelection: true,
      rowMultiSelectWithClick: true,
    };
  }, []);

  function applyRowRangeSelection(a: number, b: number) {
    const api = gridApiRef.current;
    if (!api) return;

    const lo = Math.min(a, b);
    const hi = Math.max(a, b);

    // 선택 시각화: 범위 안은 selected
    api.forEachNode((node) => {
      const idx = node.rowIndex ?? -1;
      node.setSelected(idx >= lo && idx <= hi);
    });

    // 좌측 row range 자동 입력
    setStart(lo);
    setEnd(hi + 1); // [start, end)라서 +1
  }

  function onCellMouseDown(e: CellMouseDownEvent) {
    if (e.node?.rowIndex == null) return;
    setIsMouseDown(true);
    setDragStartRow(e.node.rowIndex);
    applyRowRangeSelection(e.node.rowIndex, e.node.rowIndex);
  }

  function onCellMouseOver(e: CellMouseOverEvent) {
    if (!isMouseDown) return;
    if (dragStartRow == null) return;
    if (e.node?.rowIndex == null) return;
    applyRowRangeSelection(dragStartRow, e.node.rowIndex);
  }

  useEffect(() => {
    const up = () => {
      setIsMouseDown(false);
      setDragStartRow(null);
    };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  async function runStats(cols: string[]) {
    if (!datasetId) return;
    if (!cols.length) {
      setStats(null);
      return;
    }

    try {
      setError("");
      const body = {
        columns: cols,
        row_range: { start, end },
        metrics: ["avg", "max"],
      };
      const j = await postStats(datasetId, body);
      setStats(j);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }

  // 컬럼 클릭 시: 선택 토글 + (원하면) 즉시 계산
  async function toggleColumn(c: string) {
    const next = selectedColumns.includes(c)
      ? selectedColumns.filter((x) => x !== c)
      : [...selectedColumns, c];

    setSelectedColumns(next);

    // ✅ "클릭하면 값(통계)이 오고"를 원해서 자동 호출 넣음
    // 싫으면 아래 줄 삭제하고 버튼만 누르게 하면 됨.
    await runStats(next);
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "340px 1fr 420px", height: "100vh" }}>
      {/* Left */}
      <div style={{ padding: 12, borderRight: "1px solid #ddd", overflow: "auto" }}>
        <h2 style={{ margin: "0 0 8px 0" }}>Datasets</h2>
        <select value={datasetId} onChange={(e) => setDatasetId(e.target.value)} style={{ width: "100%", padding: 8 }}>
          {datasets.map((d) => (
            <option key={d.dataset_id} value={d.dataset_id}>
              {d.filename}
            </option>
          ))}
        </select>

        <h2 style={{ margin: "16px 0 8px 0" }}>Columns ({allColumns.length})</h2>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setSelectedColumns(allColumns.slice(0, 5))}>Pick 5</button>
          <button onClick={() => setSelectedColumns([])}>Clear</button>
          <button onClick={() => runStats(selectedColumns)} style={{ marginLeft: "auto" }}>
            Avg/Max 계산
          </button>
        </div>

        <div style={{ marginTop: 8, maxHeight: 520, overflow: "auto", border: "1px solid #eee" }}>
          {allColumns.map((c) => {
            const checked = selectedColumns.includes(c);
            return (
              <div
                key={c}
                onClick={() => toggleColumn(c)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 10px",
                  cursor: "pointer",
                  background: checked ? "#f3f7ff" : "transparent",
                  borderBottom: "1px solid #f3f3f3",
                  userSelect: "none",
                }}
              >
                <input type="checkbox" checked={checked} readOnly />
                <span style={{ fontFamily: "monospace", fontSize: 13 }}>{c}</span>
              </div>
            );
          })}
        </div>

        <h2 style={{ margin: "16px 0 8px 0" }}>Row Range</h2>
        <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
          테이블에서 마우스로 위/아래 드래그하면 자동으로 채워짐.
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="number"
            value={start}
            onChange={(e) => setStart(Number(e.target.value))}
            style={{ width: "50%", padding: 8 }}
          />
          <input
            type="number"
            value={end}
            onChange={(e) => setEnd(Number(e.target.value))}
            style={{ width: "50%", padding: 8 }}
          />
        </div>

        {error && (
          <div style={{ marginTop: 12, color: "crimson", whiteSpace: "pre-wrap" }}>
            {error}
          </div>
        )}
      </div>

      {/* Middle: Grid */}
      <div className="ag-theme-alpine" style={{ width: "100%", height: "100%" }}>
        <AgGridReact
          gridOptions={gridOptions}
          rowData={rowData}
          columnDefs={columnDefs}
          onGridReady={(params) => {
            gridApiRef.current = params.api;
          }}
          onCellMouseDown={onCellMouseDown}
          onCellMouseOver={onCellMouseOver}
        />
      </div>

      {/* Right: Stats */}
      <div style={{ padding: 12, borderLeft: "1px solid #ddd", overflow: "auto" }}>
        <h2 style={{ margin: "0 0 8px 0" }}>Stats</h2>

        <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
          선택된 컬럼: {selectedColumns.length}개 / row: [{start}, {end})
        </div>

        {!stats ? (
          <div style={{ color: "#444" }}>
            컬럼을 클릭(체크)하거나, Avg/Max 계산 버튼을 눌러.
          </div>
        ) : (
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>
            {JSON.stringify(stats, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
