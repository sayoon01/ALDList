import { useMemo } from "react";
import { Dataset, ColumnMeta } from "../api";
import "./Sidebar.css";

type RowRange = { start: number; end: number } | null;

interface SidebarProps {
  // datasets
  datasets: Dataset[];
  selectedDatasetId: string;
  onDatasetChange: (id: string) => void;

  // preview range
  offset: number;
  limit: number;
  onOffsetChange: (v: number) => void;
  onLimitChange: (v: number) => void;

  // stats range
  manualRowStart: number;
  manualRowEnd: number;
  onManualRowStartChange: (v: number) => void;
  onManualRowEndChange: (v: number) => void;

  rowRange: RowRange;
  onRowRangeReset: () => void;

  // stats mode
  statsComputeMode: "all" | "active";
  onStatsComputeModeChange: (v: "all" | "active") => void;

  // columns/meta
  visibleColumns: string[];
  allColumns: string[];
  columnMeta: Record<string, ColumnMeta>;
  activeColumn: string | null;

  onVisibleColumnsChange: (cols: string[]) => void;
  onActiveColumnChange: (col: string | null) => void;

  // search/filter
  columnSearchQuery: string;
  onColumnSearchQueryChange: (q: string) => void;

  selectedTypeFilter: string | null;
  onSelectedTypeFilterChange: (t: string | null) => void;

  // ✅ 타입 UI에 필요한 카탈로그
  orderedTypes: string[];
  metaTypeLabels: Record<string, string>;

  // ✅ 여기만 새로 추가: Sidebar는 이것만 호출
  onTypeSelect: (type: string | null) => void;

  // misc
  isLoadingStats: boolean;
  onCalculateStats: () => void;

  showSelectedOnly: boolean;
  onShowSelectedOnlyChange: (v: boolean) => void;
}

function Section(props: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div className="sb-section" id={props.id}>
      <div className="sb-section-title">{props.title}</div>
      <div className="sb-section-body">{props.children}</div>
    </div>
  );
}

export default function Sidebar(props: SidebarProps) {
  const {
    datasets,
    selectedDatasetId,
    onDatasetChange,

    offset,
    limit,
    onOffsetChange,
    onLimitChange,

    manualRowStart,
    manualRowEnd,
    onManualRowStartChange,
    onManualRowEndChange,

    rowRange,
    onRowRangeReset,

    statsComputeMode,
    onStatsComputeModeChange,

    visibleColumns,
    allColumns,
    columnMeta,
    activeColumn,
    onVisibleColumnsChange,
    onActiveColumnChange,

    columnSearchQuery,
    onColumnSearchQueryChange,

    selectedTypeFilter,
    // ✅ 이제 selectedTypeFilter는 "표시 상태"로만 쓰고, 변경은 onTypeSelect가 담당
    // onSelectedTypeFilterChange,

    orderedTypes,
    metaTypeLabels,
    onTypeSelect,

    isLoadingStats,
    onCalculateStats,

    showSelectedOnly,
    onShowSelectedOnlyChange,
  } = props;

  const selectedDs = useMemo(
    () => datasets.find((d) => d.dataset_id === selectedDatasetId) || null,
    [datasets, selectedDatasetId]
  );

  // base columns (showSelectedOnly 토글 반영)
  const baseColumns = useMemo(() => {
    if (showSelectedOnly) return visibleColumns;
    return allColumns;
  }, [showSelectedOnly, visibleColumns, allColumns]);

  // 검색 필터
  const filteredColumns = useMemo(() => {
    const q = columnSearchQuery.trim().toLowerCase();
    if (!q) return baseColumns;
    return baseColumns.filter((col) => {
      const m = columnMeta[col];
      return (
        col.toLowerCase().includes(q) ||
        (m?.title || "").toLowerCase().includes(q) ||
        (m?.desc || "").toLowerCase().includes(q) ||
        (m?.name_ko || "").toLowerCase().includes(q) ||
        (m?.name_en || "").toLowerCase().includes(q)
      );
    });
  }, [baseColumns, columnSearchQuery, columnMeta]);

  // 타입 카운트
  const typeCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of allColumns) {
      const t = columnMeta[c]?.type;
      if (!t) continue;
      m[t] = (m[t] || 0) + 1;
    }
    return m;
  }, [allColumns, columnMeta]);

  // 화면에 보여줄 타입 목록: 서버 order(orderedTypes) 우선
  const availableTypes = useMemo(() => {
    const ts = orderedTypes && orderedTypes.length ? orderedTypes : [];
    // 그래도 비어있으면 columnMeta에서 추출
    if (ts.length) return ts;
    const s = new Set<string>();
    for (const c of allColumns) {
      const t = columnMeta[c]?.type;
      if (t) s.add(t);
    }
    return Array.from(s);
  }, [orderedTypes, allColumns, columnMeta]);

  return (
    <div className="sidebar">
      <div className="sb-sticky-top">
        <div className="sb-current">
          <div className="sb-current-title">현재 데이터셋</div>
          <div className="sb-current-name">{selectedDs ? selectedDs.filename : "—"}</div>
        </div>
      </div>

      <div className="sb-scroll">
        <Section id="dataset" title="데이터셋 선택">
          <select
            value={selectedDatasetId}
            onChange={(e) => onDatasetChange(e.target.value)}
            className="select-input"
          >
            {datasets.map((ds) => (
              <option key={ds.dataset_id} value={ds.dataset_id}>
                {ds.filename} ({ds.columns.length} 컬럼)
              </option>
            ))}
          </select>
        </Section>

        <Section id="preview" title="미리보기 범위">
          <div className="sb-row">
            <label>offset</label>
            <input
              type="number"
              value={offset}
              onChange={(e) => onOffsetChange(Number(e.target.value))}
              className="num-input"
            />
          </div>
          <div className="sb-row">
            <label>limit</label>
            <input
              type="number"
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              className="num-input"
            />
          </div>
        </Section>

        <Section id="statsRange" title="통계 범위">
          <div className="sb-row">
            <label>start</label>
            <input
              type="number"
              value={manualRowStart}
              onChange={(e) => onManualRowStartChange(Number(e.target.value))}
              className="num-input"
            />
          </div>
          <div className="sb-row">
            <label>end</label>
            <input
              type="number"
              value={manualRowEnd}
              onChange={(e) => onManualRowEndChange(Number(e.target.value))}
              className="num-input"
            />
          </div>

          {rowRange && (
            <div className="sb-hint">
              선택됨: {rowRange.start + 1} ~ {rowRange.end + 1}행
              <button className="btn-small" onClick={onRowRangeReset} style={{ marginLeft: 8 }}>
                선택 초기화
              </button>
            </div>
          )}

          <div className="sb-row">
            <label>계산 모드</label>
            <select
              value={statsComputeMode}
              onChange={(e) => onStatsComputeModeChange(e.target.value as "all" | "active")}
              className="select-input"
            >
              <option value="all">보이는 컬럼 전체</option>
              <option value="active">활성 컬럼만</option>
            </select>
          </div>

          <button className="btn" disabled={isLoadingStats} onClick={onCalculateStats}>
            {isLoadingStats ? "계산 중..." : "통계 계산"}
          </button>
        </Section>

        <Section id="columnSelect" title="컬럼 선택">
          {/* ✅ 타입 바: 이제 여기서 API 안 부름 */}
          <div className="sb-typebar">
            <button
              className={`sb-typebtn ${selectedTypeFilter === null ? "active" : ""}`}
              onClick={() => onTypeSelect(null)}
            >
              전체
            </button>

            {availableTypes.map((type) => {
              const count = typeCounts[type] || 0;
              return (
                <button
                  key={type}
                  className={`sb-typebtn ${selectedTypeFilter === type ? "active" : ""}`}
                  onClick={() => onTypeSelect(type)}
                >
                  {metaTypeLabels[type] || type} ({count})
                </button>
              );
            })}
          </div>

          <div className="sb-row" style={{ marginTop: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={showSelectedOnly}
                onChange={(e) => onShowSelectedOnlyChange(e.target.checked)}
              />
              선택한 컬럼만 보기
            </label>
          </div>

          <input
            type="text"
            placeholder="🔍 컬럼 검색..."
            value={columnSearchQuery}
            onChange={(e) => onColumnSearchQueryChange(e.target.value)}
            className="sb-search"
          />

          <div className="column-list-wrap">
            <div className="column-list">
              {filteredColumns.map((col) => {
                const isChecked = visibleColumns.includes(col);
                const isActive = activeColumn === col;

                return (
                  <label
                    key={col}
                    data-column={col}
                    className={`column-checkbox ${isActive ? "active" : ""}`}
                    onClick={() => onActiveColumnChange(col)}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        if (checked) {
                          if (!visibleColumns.includes(col)) {
                            onVisibleColumnsChange([...visibleColumns, col]);
                          }
                          onActiveColumnChange(col);
                        } else {
                          const next = visibleColumns.filter((c) => c !== col);
                          onVisibleColumnsChange(next);
                          if (activeColumn === col) {
                            onActiveColumnChange(next.length > 0 ? next[0] : null);
                          }
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="col-label">{col}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
