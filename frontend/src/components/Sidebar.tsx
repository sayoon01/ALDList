import { Dataset, ColumnMeta } from '../api';
import { getFieldsByType } from '../api';
import './Sidebar.css';

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
  statsComputeMode: 'all' | 'active';
  onStatsComputeModeChange: (mode: 'all' | 'active') => void;
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
}

function Sidebar({
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
}: SidebarProps) {
  return (
    <div className="sidebar">
      <div className="section">
        <h2>데이터셋 선택</h2>
        {datasets.length === 0 ? (
          <div style={{ 
            padding: "12px", 
            backgroundColor: "#fff3cd", 
            borderRadius: "4px",
            fontSize: "13px",
            color: "#856404"
          }}>
            데이터셋을 불러오는 중...<br />
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
      </div>

      <div className="section compact-section">
        <h2>화면 표시 범위</h2>
        <div className="compact-input-row">
          <div className="compact-input-group">
            <label>시작</label>
            <input
              type="number"
              value={offset}
              onChange={(e) => onOffsetChange(Number(e.target.value))}
              min="0"
              className="compact-input"
            />
          </div>
          <div className="compact-input-group">
            <label>개수</label>
            <input
              type="number"
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              min="1"
              max="10000"
              className="compact-input"
            />
          </div>
          <button onClick={() => onOffsetChange(0)} className="btn-compact">
            처음
          </button>
        </div>
      </div>

      <div className="section compact-section">
        <h2>통계 계산 범위</h2>
        <div className="compact-input-row">
          <div className="compact-input-group">
            <label>시작</label>
            <input
              type="number"
              value={manualRowStart === 0 && manualRowEnd === 0 ? '' : manualRowStart + 1}
              onChange={(e) => {
                const val = e.target.value === '' ? 0 : Number(e.target.value) - 1;
                onManualRowStartChange(Math.max(0, val));
              }}
              min="1"
              placeholder="1"
              className="compact-input"
            />
          </div>
          <div className="compact-input-group">
            <label>끝</label>
            <input
              type="number"
              value={manualRowStart === 0 && manualRowEnd === 0 ? '' : manualRowEnd + 1}
              onChange={(e) => {
                const val = e.target.value === '' ? 0 : Number(e.target.value) - 1;
                onManualRowEndChange(Math.max(0, val));
              }}
              min="1"
              placeholder="1"
              className="compact-input"
            />
          </div>
          <button 
            onClick={onRowRangeReset} 
            className="btn-compact"
          >
            초기화
          </button>
        </div>
        {rowRange && (
          <div className="range-info-compact">
            드래그: {rowRange.start + 1}~{rowRange.end + 1}행 ({rowRange.end - rowRange.start + 1}개)
          </div>
        )}
        
        {/* 통계 계산 대상 컬럼 선택 */}
        <div style={{ marginTop: 12, marginBottom: 12, padding: 8, backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: 4 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            계산 대상 컬럼
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: 12 }}>
              <input
                type="radio"
                name="statsComputeMode"
                value="all"
                checked={statsComputeMode === 'all'}
                onChange={(e) => onStatsComputeModeChange(e.target.value as 'all' | 'active')}
                style={{ marginRight: 6 }}
              />
              <span>전체 표시 컬럼 ({visibleColumns.length}개)</span>
            </label>
            <label 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                cursor: activeColumn ? 'pointer' : 'not-allowed',
                fontSize: 12,
                opacity: activeColumn ? 1 : 0.5
              }}
            >
              <input
                type="radio"
                name="statsComputeMode"
                value="active"
                checked={statsComputeMode === 'active'}
                onChange={(e) => onStatsComputeModeChange(e.target.value as 'all' | 'active')}
                disabled={!activeColumn}
                style={{ marginRight: 6 }}
              />
              <span>
                활성 컬럼만 {activeColumn && `(${columnMeta[activeColumn]?.title ?? activeColumn})`}
                {!activeColumn && '(컬럼 선택 필요)'}
              </span>
            </label>
          </div>
        </div>
        
        <button
          onClick={onCalculateStats}
          disabled={
            isLoadingStats || 
            visibleColumns.length === 0 || 
            ((manualRowStart === 0 && manualRowEnd === 0) && !rowRange) ||
            (statsComputeMode === 'active' && !activeColumn)
          }
          className="btn-primary"
        >
          {isLoadingStats ? '계산 중...' : '통계 계산'}
        </button>
        {(manualRowStart === 0 && manualRowEnd === 0 && !rowRange) && (
          <div className="hint-text">
            💡 범위를 입력하거나 그리드에서 행을 드래그하여 범위를 선택하세요
          </div>
        )}
        {statsComputeMode === 'active' && !activeColumn && (
          <div className="hint-text" style={{ marginTop: 8 }}>
            💡 왼쪽에서 컬럼을 선택하면 활성 컬럼만 계산할 수 있습니다
          </div>
        )}
      </div>

      <div className="section">
        <h2>컬럼 선택</h2>
        <div className="column-selector">
          <div className="column-selector-header">
            <span>표시할 컬럼 선택 ({visibleColumns.length}/{allColumns.length})</span>
            <div className="column-selector-buttons">
              <button
                onClick={() => onVisibleColumnsChange(allColumns)}
                className="btn-small"
              >
                전체 선택
              </button>
              <button
                onClick={() => onVisibleColumnsChange([])}
                className="btn-small"
              >
                모두 해제
              </button>
            </div>
          </div>
          {/* 타입 필터 버튼 */}
          <div style={{ marginBottom: "8px", display: "flex", flexWrap: "wrap", gap: "4px" }}>
            <button
              onClick={() => {
                onSelectedTypeFilterChange(null);
                onVisibleColumnsChange([]);
              }}
              style={{
                padding: "4px 8px",
                fontSize: "11px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                background: selectedTypeFilter === null ? "#3498db" : "white",
                color: selectedTypeFilter === null ? "white" : "#333",
                cursor: "pointer"
              }}
            >
              전체
            </button>
            {(() => {
              // 메타데이터에서 사용 가능한 타입 추출
              const types = new Set<string>();
              allColumns.forEach(col => {
                const m = columnMeta[col];
                if (m?.type) {
                  types.add(m.type);
                }
              });
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
                unknown: "기타"
              };
              return Array.from(types).sort().map(type => {
                const count = allColumns.filter(col => columnMeta[col]?.type === type).length;
                return (
                  <button
                    key={type}
                    onClick={async () => {
                      onSelectedTypeFilterChange(type);
                      try {
                        const result = await getFieldsByType(selectedDatasetId, type);
                        onVisibleColumnsChange(result.columns);
                      } catch (error) {
                        console.error('타입 필터 적용 실패:', error);
                        // 실패 시 클라이언트 측 필터링으로 대체
                        const filtered = allColumns.filter(col => {
                          const m = columnMeta[col];
                          return m?.type === type;
                        });
                        onVisibleColumnsChange(filtered);
                      }
                    }}
                    style={{
                      padding: "4px 8px",
                      fontSize: "11px",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      background: selectedTypeFilter === type ? "#3498db" : "white",
                      color: selectedTypeFilter === type ? "white" : "#333",
                      cursor: "pointer"
                    }}
                  >
                    {typeLabels[type] || type} ({count})
                  </button>
                );
              });
            })()}
          </div>
          {/* 컬럼 검색 필터 */}
          <div style={{ marginBottom: "8px" }}>
            <input
              type="text"
              placeholder="🔍 컬럼 검색..."
              value={columnSearchQuery}
              onChange={(e) => onColumnSearchQueryChange(e.target.value)}
              style={{
                width: "100%",
                padding: "6px 10px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                fontSize: "13px",
                boxSizing: "border-box"
              }}
            />
          </div>
          <div className="column-list">
            {(() => {
              const filteredColumns = allColumns.filter((col) => {
                // 검색 쿼리가 없으면 모두 표시
                if (!columnSearchQuery.trim()) return true;
                // 컬럼명 또는 메타데이터에서 검색
                const searchLower = columnSearchQuery.toLowerCase();
                const m = columnMeta[col];
                return (
                  col.toLowerCase().includes(searchLower) ||
                  m?.title?.toLowerCase().includes(searchLower) ||
                  m?.desc?.toLowerCase().includes(searchLower) ||
                  m?.name_ko?.toLowerCase().includes(searchLower) ||
                  m?.name_en?.toLowerCase().includes(searchLower)
                );
              });

              // 검색 결과가 없을 때
              if (filteredColumns.length === 0 && columnSearchQuery.trim()) {
                return (
                  <div style={{
                    padding: "20px",
                    textAlign: "center",
                    color: "#999",
                    fontSize: "13px"
                  }}>
                    검색 결과가 없습니다.
                    <br />
                    <span style={{ fontSize: "11px", opacity: 0.8 }}>
                      다른 검색어를 시도해보세요.
                    </span>
                  </div>
                );
              }

              return filteredColumns.map((col) => {
                const m = columnMeta[col];
                const isChecked = visibleColumns.includes(col);
                const isActive = activeColumn === col;

                const tip = m?.desc
                  ? `${m.desc}${m.unit ? ` (${m.unit})` : ""}${m.auto_generated ? " [auto]" : ""}`
                  : col;

                const labelText = col;

                return (
                  <label
                    key={col}
                    data-column={col}
                    className="column-checkbox"
                    title={tip}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "3px 6px",
                      borderRadius: 6,
                      background: isActive ? "rgba(0,0,0,0.06)" : "transparent",
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      onActiveColumnChange(col);
                    }}
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
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    />

                    <span style={{ userSelect: "none" }}>
                      {labelText}
                      {m?.importance ? (
                        <span style={{ marginLeft: 6, opacity: 0.6 }}>({m.importance})</span>
                      ) : null}
                    </span>
                  </label>
                );
              });
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Sidebar;
