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
  allowedTypes: string[];
  metaTypes: string[];
  orderedTypes: string[];
  metaTypeLabels: Record<string, string>;

  isLoadingStats: boolean;
  onCalculateStats: () => void;

  /* ✅ 선택 컬럼만 보기 토글 */
  showSelectedOnly: boolean;
  onShowSelectedOnlyChange: (v: boolean) => void;

  /* Profile/Doc 빌드 (하위 호환성 유지 - 선택적) */
  profileText?: string | null;
  docText?: string | null;
  adminBusy?: boolean;
  onBuildProfile?: () => void;
  onBuildDoc?: () => void;
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
    allowedTypes,
    metaTypes,
    orderedTypes,
    metaTypeLabels,

    isLoadingStats,
    onCalculateStats,

    showSelectedOnly,
    onShowSelectedOnlyChange,

    profileText,
    docText,
    adminBusy,
    onBuildProfile,
    onBuildDoc,
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

  // 타입 버튼 라벨은 서버에서 받은 metaTypeLabels 사용 (하드코딩 제거)

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

  // 타입 카운트 맵 (O(1) 조회를 위한 최적화)
  const typeCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of allColumns) {
      const t = columnMeta[c]?.type;
      if (!t) continue;
      m[t] = (m[t] || 0) + 1;
    }
    return m;
  }, [allColumns, columnMeta]);

  // 현재 데이터셋에 실제 존재하는 타입 집합
  const datasetTypes = useMemo(() => {
    return Array.from(
      new Set(
        allColumns
          .map((c) => columnMeta[c]?.type)
          .filter((t): t is string => typeof t === "string" && t.length > 0)
      )
    );
  }, [allColumns, columnMeta]);

  // 타입 목록: 서버에서 받은 orderedTypes와 현재 데이터셋에 실제 존재하는 타입의 교집합
  const availableTypes = useMemo(() => {
    // 1) 서버 ordered_types 우선 (순서도 서버가 정해준 순서 유지)
    // 2) 서버가 비었거나 실패한 경우 datasetTypes로 fallback
    const baseTypes =
      orderedTypes && orderedTypes.length > 0
        ? orderedTypes.filter((t) => datasetTypes.includes(t))
        : datasetTypes;

    // 서버에서 이미 정렬된 순서를 사용하므로 추가 정렬 불필요
    // (원본 배열 mutate 방지를 위해 복사본 반환)
    return [...baseTypes];
  }, [orderedTypes, datasetTypes]);

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
        {/* 프로파일 / 문서 빌드 */}
        <div className="sb-section">
          <div className="sb-section-title">프로파일 / 문서</div>
          <div className="sb-section-body">
            <div className="sb-row" style={{ display: "flex", gap: 8 }}>
              <button
                className="btn-small"
                disabled={adminBusy || !selectedDatasetId}
                onClick={onBuildProfile}
              >
                Profile 빌드
              </button>
              <button
                className="btn-small"
                disabled={adminBusy || !selectedDatasetId}
                onClick={onBuildDoc}
              >
                Doc 빌드
              </button>
            </div>
            <div className="sb-hint" style={{ marginTop: 8 }}>
              Profile: {profileText ? "있음" : "없음"} / Doc: {docText ? "있음" : "없음"}
            </div>
          </div>
        </div>

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
                  const count = typeCounts[type] || 0;
                  return (
                    <button
                      key={type}
                      className={`sb-typebtn ${selectedTypeFilter === type ? "active" : ""}`}
                      onClick={async () => {
                        onSelectedTypeFilterChange(type);
                        try {
                          const result = await getFieldsByType(selectedDatasetId, type);
                          onVisibleColumnsChange(result.columns);
                        } catch (error: any) {
                          // 에러 발생 시 fallback: 로컬 메타데이터로 필터링
                          console.warn("타입 필터 API 호출 실패, 로컬 필터링 사용:", error);
                          const filtered = allColumns.filter((c) => columnMeta[c]?.type === type);
                          onVisibleColumnsChange(filtered);
                        }
                      }}
                    >
                      {metaTypeLabels[type] || type} ({count})
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
