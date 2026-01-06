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

// Stats 변환 함수들
function toStatsRows(stats: any) {
  if (!stats?.results) return [];
  return Object.entries(stats.results).map(([col, v]: any) => ({
    column: col,
    avg: v?.avg ?? null,
    max: v?.max ?? null,
    min: v?.min ?? null,
    count: v?.count ?? null,
  }));
}

function isAllNull(row: any) {
  return row.avg == null && row.max == null && row.min == null && row.count == null;
}

function fmt(x: any) {
  if (x == null) return "—";
  if (typeof x === "number") {
    // 너무 긴 소수 방지
    const s = Number.isInteger(x) ? x.toString() : x.toFixed(4);
    return s.replace(/\.?0+$/, "");
  }
  return String(x);
}

export default function App() {
  const gridApiRef = useRef<GridApi | null>(null);
  const statsTimerRef = useRef<number | null>(null);

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
  const [isLoadingStats, setIsLoadingStats] = useState<boolean>(false);

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

  function scheduleStatsRecalc(cols: string[]) {
    if (!cols.length) return;
    if (statsTimerRef.current) window.clearTimeout(statsTimerRef.current);

    // 드래그가 끝나기 직전에 여러 번 바뀌어도 마지막 한 번만 실행
    statsTimerRef.current = window.setTimeout(() => {
      runStats(cols);
    }, 250);
  }

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

    // 드래그로 범위 바뀌면 자동 재계산
    scheduleStatsRecalc(selectedColumns);
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
      setIsLoadingStats(false);
      return;
    }

    try {
      setError("");
      setIsLoadingStats(true);
      const body = {
        columns: cols,
        row_range: { start, end },
        metrics: ["avg", "max"],
      };
      const j = await postStats(datasetId, body);
      setStats(j);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setIsLoadingStats(false);
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
            onChange={(e) => {
              const newStart = Number(e.target.value);
              setStart(newStart);
              scheduleStatsRecalc(selectedColumns);
            }}
            style={{ width: "50%", padding: 8 }}
          />
          <input
            type="number"
            value={end}
            onChange={(e) => {
              const newEnd = Number(e.target.value);
              setEnd(newEnd);
              scheduleStatsRecalc(selectedColumns);
            }}
            style={{ width: "50%", padding: 8 }}
          />
        </div>
        <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
          {start} ~ {end - 1} (총 {Math.max(0, end - start)} rows)
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
        <h2 style={{ margin: "0 0 10px 0" }}>Stats</h2>

        <div style={{ padding: 10, border: "1px solid #eee", borderRadius: 10, marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: "#666" }}>선택 요약</div>
          <div style={{ marginTop: 6, lineHeight: 1.6 }}>
            <div><b>Rows</b>: {start} ~ {end - 1} (총 {Math.max(0, end - start)}개)</div>
            <div><b>Columns</b>: {selectedColumns.length}개</div>
            <div><b>Metrics</b>: avg, max</div>
          </div>
        </div>

        {!selectedColumns.length ? (
          <div style={{ color: "#444" }}>왼쪽에서 컬럼을 선택해.</div>
        ) : isLoadingStats ? (
          <div style={{ color: "#666", padding: 20, textAlign: "center" }}>
            계산 중...
          </div>
        ) : !stats ? (
          <div style={{ color: "#444" }}>계산 중이거나 아직 결과가 없어.</div>
        ) : (
          (() => {
            const statsRows = toStatsRows(stats);
            return (
              <div style={{ border: "1px solid #eee", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 0.8fr", background: "#fafafa", padding: "10px 12px", fontWeight: 700 }}>
                  <div>Column</div>
                  <div>Avg</div>
                  <div>Max</div>
                  <div>상태</div>
                </div>

                {statsRows.map((r: any) => {
                  const nonNumeric = isAllNull(r); // avg/max 둘 다 null이면 사실상 숫자 아님
                  return (
                    <div
                      key={r.column}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1.6fr 1fr 1fr 0.8fr",
                        padding: "10px 12px",
                        borderTop: "1px solid #f0f0f0",
                        background: nonNumeric ? "#fff" : "#fff",
                        opacity: nonNumeric ? 0.6 : 1,
                      }}
                    >
                      <div style={{ fontFamily: "monospace", fontSize: 12 }}>{r.column}</div>
                      <div>{fmt(r.avg)}</div>
                      <div>{fmt(r.max)}</div>
                      <div>
                        {nonNumeric ? (
                          <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 999, background: "#f1f1f1" }}>
                            숫자 아님
                          </span>
                        ) : (
                          <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 999, background: "#eaf4ff" }}>
                            OK
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
}
