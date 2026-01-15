import { useMemo, useState } from "react";
import { Dataset, ColumnMeta } from "../api";
import { getFieldsByType } from "../api";
import "./Sidebar.css";

interface SidebarProps {
  datasets: Dataset[];
  selectedDatasetId: string;
  onDatasetChange: (datasetId: string) => void;

  offset: number;
  limit: number;
  onOffsetChange: (offset: number) => void;
  onLimitChange: (limit: number) => void;

  manualRowStart: number;
  manualRowEnd: number;
  onManualRowStartChange: (start: number) => void;
  onManualRowEndChange: (end: number) => void;

  rowRange: { start: number; end: number } | null;
  onRowRangeReset: () => void;

  statsComputeMode: "all" | "active";
  onStatsComputeModeChange: (mode: "all" | "active") => void;

  visibleColumns: string[];
  allColumns: string[];
  columnMeta: Record<string, ColumnMeta>;
  activeColumn: string | null;

  onVisibleColumnsChange: (columns: string[]) => void;
  onActiveColumnChange: (column: string | null) => void;

  columnSearchQuery: string;
  onColumnSearchQueryChange: (query: string) => void;

  selectedTypeFilter: string | null;
  onSelectedTypeFilterChange: (filter: string | null) => void;

  isLoadingStats: boolean;
  onCalculateStats: () => void;

  /* ✅ 선택 컬럼만 보기 토글 */
  showSelectedOnly: boolean;
  onShowSelectedOnlyChange: (v: boolean) => void;
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
    onSelectedTypeFilterChange,

    isLoadingStats,
    onCalculateStats,

    showSelectedOnly,
    onShowSelectedOnlyChange,
  } = props;

  const selectedDs = datasets.find((d) => d.dataset_id === selectedDatasetId) || null;

  const [open, setOpen] = useState({
    dataset: true,
    viewRange: true,
    statsRange: true,
    columnSelect: true,
  });

  const [typeBarCollapsed, setTypeBarCollapsed] = useState(false);

  const Section = ({
    id,
    title,
    right,
    children,
  }: {
    id: keyof typeof open;
    title: string;
    right?: React.ReactNode;
    children: React.ReactNode;
  }) => {
    const isOpen = open[id];
    return (
      <div className="sb-section">
        <button
          type="button"
          className="sb-section-header"
          onClick={() => setOpen((p) => ({ ...p, [id]: !p[id] }))}
        >
          <span className="sb-section-title">{title}</span>
          <span className="sb-section-right">{right}</span>
          <span className={`sb-section-chevron ${isOpen ? "open" : ""}`}>▾</span>
        </button>
        {isOpen && <div className="sb-section-body">{children}</div>}
      </div>
    );
  };

  // 타입 버튼 라벨
  const typeLabels: Record<string, string> = {
    gas: "가스",
    temperature: "온도",
    pressure: "압력",
    apc: "APC",
    valve: "밸브",
    aux: "AUX",
    heater: "히터",
    timestamp: "시간",
    recipe: "레시피",
    index: "인덱스",
    unknown: "기타",
  };

  // 표시할 컬럼 리스트 (선택만 보기 토글 반영)
  const baseColumns = showSelectedOnly ? visibleColumns : allColumns;

  const filteredColumns = useMemo(() => {
    const q = columnSearchQuery.trim().toLowerCase();
    return baseColumns.filter((col) => {
      if (!q) return true;
      const m = columnMeta[col];
      return (
        col.toLowerCase().includes(q) ||
        m?.title?.toLowerCase().includes(q) ||
        m?.desc?.toLowerCase().includes(q) ||
        m?.name_ko?.toLowerCase().includes(q) ||
        m?.name_en?.toLowerCase().includes(q)
      );
    });
  }, [baseColumns, columnSearchQuery, columnMeta]);

  // 타입 목록
  const availableTypes = useMemo(() => {
    const types = new Set<string>();
    allColumns.forEach((col) => {
      const m = columnMeta[col];
      if (m?.type) types.add(m.type);
    });
    return Array.from(types).sort();
  }, [allColumns, columnMeta]);

  return (
    <div className="sidebar">
      {/* ✅ sticky top: 현재 데이터셋 */}
      <div className="sb-sticky-top">
        <div className="sb-current">
          <div className="sb-current-title">현재 데이터셋</div>
          <div className="sb-current-name">{selectedDs ? selectedDs.filename : "—"}</div>
          <div className="sb-current-sub">{selectedDs ? `${selectedDs.columns.length} columns` : ""}</div>
        </div>
      </div>

      <div className="sb-scroll">
        {/* 데이터셋 선택 */}
        <Section id="dataset" title="데이터셋 선택">
          {datasets.length === 0 ? (
            <div className="sb-alert">
              데이터셋을 불러오는 중...
              <br />
              <small>백엔드 서버가 실행 중인지 확인하세요.</small>
            </div>
          ) : (
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
          )}
        </Section>

        {/* 화면 표시 범위 */}
        <Section id="viewRange" title="화면 표시 범위">
          <div className="sb-row">
            <div className="sb-field">
              <label>시작</label>
              <input
                type="number"
                value={offset + 1}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  onOffsetChange(Math.max(0, val - 1));
                }}
                min={1}
                className="compact-input"
              />
            </div>

            <div className="sb-field">
              <label>개수</label>
              <input
                type="number"
                value={limit}
                onChange={(e) => onLimitChange(Number(e.target.value))}
                min={1}
                max={10000}
                className="compact-input"
              />
            </div>

            <button onClick={() => onOffsetChange(0)} className="btn-compact">
              처음
            </button>
          </div>
        </Section>

        {/* 통계 계산 범위 */}
        <Section
          id="statsRange"
          title="통계 계산 범위"
          right={
            rowRange ? (
              <span className="sb-pill">
                {rowRange.start + 1}~{rowRange.end + 1}
              </span>
            ) : (
              <span className="sb-pill muted">미선택</span>
            )
          }
        >
          <div className="sb-row">
            <div className="sb-field">
              <label>시작</label>
              <input
                type="number"
                value={manualRowStart === 0 && manualRowEnd === 0 ? "" : manualRowStart + 1}
                onChange={(e) => {
                  const val = e.target.value === "" ? 0 : Number(e.target.value) - 1;
                  onManualRowStartChange(Math.max(0, val));
                }}
                min={1}
                placeholder="1"
                className="compact-input"
              />
            </div>

            <div className="sb-field">
              <label>끝</label>
              <input
                type="number"
                value={manualRowStart === 0 && manualRowEnd === 0 ? "" : manualRowEnd + 1}
                onChange={(e) => {
                  const val = e.target.value === "" ? 0 : Number(e.target.value) - 1;
                  onManualRowEndChange(Math.max(0, val));
                }}
                min={1}
                placeholder="1"
                className="compact-input"
              />
            </div>

            <button onClick={onRowRangeReset} className="btn-compact">
              초기화
            </button>
          </div>

          {rowRange && (
            <div className="sb-sub">
              드래그: {rowRange.start + 1}~{rowRange.end + 1}행 ({rowRange.end - rowRange.start + 1}개)
            </div>
          )}

          <div className="sb-box">
            <div className="sb-box-title">계산 대상 컬럼</div>

            <label className="sb-radio">
              <input
                type="radio"
                name="statsComputeMode"
                value="all"
                checked={statsComputeMode === "all"}
                onChange={(e) => onStatsComputeModeChange(e.target.value as "all" | "active")}
              />
              <span>전체 표시 컬럼 ({visibleColumns.length}개)</span>
            </label>

            <label className={`sb-radio ${!activeColumn ? "disabled" : ""}`}>
              <input
                type="radio"
                name="statsComputeMode"
                value="active"
                checked={statsComputeMode === "active"}
                onChange={(e) => onStatsComputeModeChange(e.target.value as "all" | "active")}
                disabled={!activeColumn}
              />
              <span>
                활성 컬럼만{" "}
                {activeColumn ? `(${columnMeta[activeColumn]?.title ?? activeColumn})` : "(컬럼 선택 필요)"}
              </span>
            </label>
          </div>

          <button
            onClick={onCalculateStats}
            className="btn-primary"
            disabled={
              isLoadingStats ||
              visibleColumns.length === 0 ||
              ((manualRowStart === 0 && manualRowEnd === 0) && !rowRange) ||
              (statsComputeMode === "active" && !activeColumn)
            }
          >
            {isLoadingStats ? "계산 중..." : "통계 계산"}
          </button>

          {(manualRowStart === 0 && manualRowEnd === 0 && !rowRange) && (
            <div className="hint-text">
              💡 범위를 입력하거나 그리드에서 행을 드래그하여 범위를 선택하세요
            </div>
          )}
        </Section>

        {/* 컬럼 선택 */}
        <Section
          id="columnSelect"
          title="컬럼 선택"
          right={<span className="sb-pill">{visibleColumns.length}/{allColumns.length}</span>}
        >
          <div className="sb-topline">
            <div className="sb-muted">표시할 컬럼 선택</div>
            <div className="sb-btns">
              <button onClick={() => onVisibleColumnsChange(allColumns)} className="btn-small">
                전체 선택
              </button>
              <button onClick={() => onVisibleColumnsChange([])} className="btn-small">
                모두 해제
              </button>
            </div>
          </div>

          {/* ✅ 선택한 컬럼만 보기 토글 */}
          <div className="sb-toggle-row">
            <label className="sb-toggle">
              <input
                type="checkbox"
                checked={showSelectedOnly}
                onChange={(e) => onShowSelectedOnlyChange(e.target.checked)}
              />
              <span>선택한 컬럼만 보기</span>
            </label>

            <button
              className="btn-small"
              onClick={() => onShowSelectedOnlyChange(false)}
              disabled={!showSelectedOnly}
            >
              전체 보기
            </button>
          </div>

          {/* 타입 필터 - 접을 수 있게 */}
          <div className="sb-typebar-wrapper">
            <button
              className="sb-typebar-toggle"
              onClick={() => setTypeBarCollapsed(!typeBarCollapsed)}
            >
              <span>타입 필터</span>
              <span className={`sb-typebar-chevron ${typeBarCollapsed ? "collapsed" : ""}`}>▾</span>
            </button>
            {!typeBarCollapsed && (
              <div className="sb-typebar">
                <button
                  className={`sb-typebtn ${selectedTypeFilter === null ? "active" : ""}`}
                  onClick={() => {
                    onSelectedTypeFilterChange(null);
                    onVisibleColumnsChange([]);
                  }}
                >
                  전체
                </button>

                {availableTypes.map((type) => {
                  const count = allColumns.filter((c) => columnMeta[c]?.type === type).length;
                  return (
                    <button
                      key={type}
                      className={`sb-typebtn ${selectedTypeFilter === type ? "active" : ""}`}
                      onClick={async () => {
                        onSelectedTypeFilterChange(type);
                        try {
                          const result = await getFieldsByType(selectedDatasetId, type);
                          onVisibleColumnsChange(result.columns);
                        } catch {
                          const filtered = allColumns.filter((c) => columnMeta[c]?.type === type);
                          onVisibleColumnsChange(filtered);
                        }
                      }}
                    >
                      {typeLabels[type] || type} ({count})
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 검색 */}
          <input
            type="text"
            placeholder="🔍 컬럼 검색..."
            value={columnSearchQuery}
            onChange={(e) => onColumnSearchQueryChange(e.target.value)}
            className="sb-search"
          />

          {/* ✅ 고정 높이 + 스크롤 */}
          <div className="column-list-wrap">
            {filteredColumns.length === 0 && columnSearchQuery.trim() ? (
              <div className="sb-empty">
                검색 결과가 없습니다.
                <div className="sb-empty-sub">다른 검색어를 시도해보세요.</div>
              </div>
            ) : (
              <div className="column-list">
                {filteredColumns.map((col) => {
                  const m = columnMeta[col];
                  const isChecked = visibleColumns.includes(col);
                  const isActive = activeColumn === col;

                  const tip = m?.desc
                    ? `${m.desc}${m.unit ? ` (${m.unit})` : ""}${m.auto_generated ? " [auto]" : ""}`
                    : col;

                  return (
                    <label
                      key={col}
                      data-column={col}
                      className={`column-checkbox ${isActive ? "active" : ""}`}
                      title={tip}
                      onClick={() => onActiveColumnChange(col)}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          if (checked) {
                            if (!visibleColumns.includes(col)) onVisibleColumnsChange([...visibleColumns, col]);
                            onActiveColumnChange(col);
                          } else {
                            const next = visibleColumns.filter((c) => c !== col);
                            onVisibleColumnsChange(next);
                            if (activeColumn === col) onActiveColumnChange(next.length > 0 ? next[0] : null);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="col-label">
                        {col}
                        {m?.importance ? <span className="col-imp">({m.importance})</span> : null}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}
