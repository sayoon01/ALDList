import { ColumnsPanelProps } from './types';
import { SelectedChips } from '../SelectedChips';

export const ColumnsPanel = ({
  visibleColumns,
  setVisibleColumns,
  allColumns,
  columnMeta,
  activeColumn,
  setActiveColumn,
  activeType,
  setActiveType,
  typeCounts,
  columnSearchQuery,
  setColumnSearchQuery,
  showAllColumnList,
  setShowAllColumnList,
  focusColumn,
}: ColumnsPanelProps) => {
  return (
    <div className="panel">
      <div className="panel-header">
        <h3>🧩 컬럼</h3>
        <div className="sub">
          선택됨: {visibleColumns.length}개 · 타입: {activeType === "__all__" ? "전체" : activeType}
        </div>
      </div>

      <div className="panel-body">
        {/* 선택된 컬럼 태그 요약 (최대 12개만) */}
        <SelectedChips
          visibleColumns={visibleColumns}
          activeColumn={activeColumn}
          setVisibleColumns={setVisibleColumns}
          setActiveColumn={setActiveColumn}
          focusColumn={focusColumn}
        />

        {/* 타입 필터 버튼 */}
        <div style={{ marginBottom: "12px", marginTop: "12px" }}>
          <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: 6, color: "#666" }}>타입:</div>
          <div className="type-filter" style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
            <button
              className={activeType === "__all__" ? "active" : ""}
              onClick={() => {
                setActiveType("__all__");
                setVisibleColumns(allColumns);
              }}
              style={{
                padding: "4px 8px",
                fontSize: "11px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                background: activeType === "__all__" ? "#3498db" : "white",
                color: activeType === "__all__" ? "white" : "#333",
                cursor: "pointer"
              }}
            >
              전체 ({allColumns.length})
            </button>
            {typeCounts.map(({ type, count }) => (
              <button
                key={type}
                className={activeType === type ? "active" : ""}
                onClick={() => {
                  setActiveType(type);
                  const cols = allColumns.filter(
                    (c) => columnMeta[c]?.type === type
                  );
                  setVisibleColumns(cols);
                }}
                style={{
                  padding: "4px 8px",
                  fontSize: "11px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  background: activeType === type ? "#3498db" : "white",
                  color: activeType === type ? "white" : "#333",
                  cursor: "pointer"
                }}
              >
                {type} ({count})
              </button>
            ))}
          </div>
        </div>
        
        {/* 컬럼 검색 필터 */}
        <div style={{ marginBottom: "12px" }}>
          <input
            type="text"
            placeholder="🔍 컬럼 검색..."
            value={columnSearchQuery}
            onChange={(e) => setColumnSearchQuery(e.target.value)}
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
        
        {/* 전체 선택/해제 및 전체 보기 버튼 */}
        <div style={{ marginBottom: "12px", display: "flex", gap: 4, flexWrap: "wrap" }}>
          <button
            onClick={() => setVisibleColumns(allColumns)}
            className="btn btn-ghost"
            style={{
              padding: "4px 8px",
              fontSize: "11px"
            }}
          >
            모두 선택
          </button>
          <button
            onClick={() => setVisibleColumns([])}
            className="btn btn-ghost"
            style={{
              padding: "4px 8px",
              fontSize: "11px"
            }}
          >
            모두 해제
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => setShowAllColumnList(!showAllColumnList)}
            style={{
              padding: "4px 8px",
              fontSize: "11px"
            }}
          >
            {showAllColumnList ? "목록 접기" : "전체 컬럼 보기"}
          </button>
        </div>

        {/* 컬럼 리스트 (기본 숨김) */}
        {showAllColumnList && (
          <div className="column-list" style={{ maxHeight: "300px", overflowY: "auto" }}>
            {(() => {
              const filteredColumns = allColumns.filter((col) => {
                if (!columnSearchQuery.trim()) return true;
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
                const isSelected = visibleColumns.includes(col);
                const m = columnMeta[col];
                return (
                  <label
                    key={col}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 8px",
                      cursor: "pointer",
                      borderRadius: "4px",
                      backgroundColor: isSelected ? "#e3f2fd" : "transparent",
                      transition: "background-color 0.2s"
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = "#f5f5f5";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        if (isSelected) {
                          setVisibleColumns(visibleColumns.filter((c) => c !== col));
                          if (activeColumn === col) {
                            setActiveColumn(visibleColumns.filter((c) => c !== col)[0] || "");
                          }
                        } else {
                          setVisibleColumns([...visibleColumns, col]);
                        }
                      }}
                      style={{ cursor: "pointer" }}
                    />
                    <span style={{ fontSize: "12px", flex: 1 }}>
                      {col}
                      {m && (
                        <span style={{ fontSize: "10px", color: "#999", marginLeft: 4 }}>
                          ({m.type || "unknown"})
                        </span>
                      )}
                    </span>
                  </label>
                );
              });
            })()}
          </div>
        )}
      </div>
    </div>
  );
};
