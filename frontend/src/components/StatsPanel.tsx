import { ColumnMeta, StatsResponse } from '../api';
import './StatsPanel.css';

interface StatsPanelProps {
  activeColumn: string | null;
  columnMeta: Record<string, ColumnMeta>;
  stats: StatsResponse | null;
}

function StatsPanel({ activeColumn, columnMeta, stats }: StatsPanelProps) {
  return (
    <div className="stats-panel">
      <div className="section">
        <h2>컬럼 상세</h2>

        {!activeColumn ? (
          <div style={{ 
            opacity: 0.75, 
            padding: "20px",
            textAlign: "center",
            fontSize: 14,
            color: "#666"
          }}>
            💡 그리드 헤더를 클릭하거나<br />왼쪽에서 컬럼을 선택하면<br />상세 정보를 확인할 수 있습니다.
          </div>
        ) : (
          (() => {
            const m = columnMeta[activeColumn];
            const title = m?.title ?? activeColumn;

            // 상세 정보를 툴팁용 텍스트로 구성
            const detailInfo: string[] = [];
            if (m?.type) detailInfo.push(`유형: ${m.type}`);
            if (m?.category) detailInfo.push(`구분: ${m.category}`);
            if (m?.unit) detailInfo.push(`단위: ${m.unit}`);
            if (m?.equipment_field) detailInfo.push(`장비 필드명: ${m.equipment_field}`);
            const hasDetailInfo = detailInfo.length > 0;

            return (
              <div style={{ display: "grid", gap: 16 }}>
                {/* 컬럼 기본 정보 및 설명 통합 */}
                <div 
                  className={hasDetailInfo ? "column-detail-tooltip" : ""}
                  style={{
                    padding: "16px",
                    backgroundColor: "#f8f9fa",
                    borderRadius: "8px",
                    border: "1px solid #e9ecef",
                    position: "relative",
                    cursor: hasDetailInfo ? "help" : "default"
                  }}
                >
                  {/* 커스텀 툴팁 */}
                  {hasDetailInfo && (
                    <div className="tooltip-content">
                      <div style={{ fontWeight: 600, marginBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.3)", paddingBottom: 4 }}>
                        상세 정보
                      </div>
                      {detailInfo.map((info, idx) => (
                        <div key={idx} style={{ marginBottom: idx < detailInfo.length - 1 ? 4 : 0 }}>
                          {info}
                        </div>
                      ))}
                    </div>
                  )}
                  {/* 컬럼명과 원본 컬럼명 나란히 배치 */}
                  <div style={{ 
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: 12
                  }}>
                    <div style={{ 
                      fontSize: 18, 
                      fontWeight: 700,
                      color: "#212529"
                    }}>
                      {title}
                    </div>
                    <div style={{
                      fontSize: 12,
                      color: "#6c757d",
                      fontFamily: "monospace",
                      padding: "4px 8px",
                      backgroundColor: "#fff",
                      borderRadius: "4px",
                      display: "inline-block"
                    }}>
                      {activeColumn}
                    </div>
                  </div>

                  {/* 설명 */}
                  {m?.desc ? (
                    <div style={{ 
                      lineHeight: 1.6,
                      fontSize: 14,
                      color: "#212529",
                      marginTop: 8,
                      marginBottom: 12
                    }}>
                      {m.desc}
                    </div>
                  ) : (
                    <div style={{ 
                      fontSize: 13, 
                      color: "#6c757d",
                      marginTop: 8,
                      marginBottom: 12,
                      fontStyle: "italic"
                    }}>
                      설명이 없습니다.
                      {m?.auto_generated && (
                        <div style={{ marginTop: 8, fontSize: 11 }}>
                          💡 <code>global_columns.yaml</code>에 추가하면 더 자세한 설명을 제공할 수 있습니다.
                        </div>
                      )}
                    </div>
                  )}

                  {/* 구분선 */}
                  {(m?.name_ko || m?.name_en || m?.importance) && (
                    <div style={{
                      marginTop: 12,
                      marginBottom: 12,
                      paddingTop: 12,
                      borderTop: "1px solid #dee2e6"
                    }}>
                      {/* 한글/영문 이름 */}
                      {(m?.name_ko || m?.name_en) && (
                        <div style={{ 
                          fontSize: 13,
                          color: "#495057",
                          marginBottom: 8
                        }}>
                          {m?.name_ko && <span>{m.name_ko}</span>}
                          {m?.name_ko && m?.name_en && <span style={{ margin: "0 4px" }}>/</span>}
                          {m?.name_en && <span style={{ fontStyle: "italic" }}>{m.name_en}</span>}
                        </div>
                      )}

                      {/* 중요도 배지 */}
                      {m?.importance && (
                        <div>
                          <span style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: "12px",
                            fontSize: 11,
                            fontWeight: 600,
                            backgroundColor: m.importance === "A" ? "#fff3cd" : m.importance === "B" ? "#d1ecf1" : "#f8d7da",
                            color: m.importance === "A" ? "#856404" : m.importance === "B" ? "#0c5460" : "#721c24"
                          }}>
                            중요도 {m.importance}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* 상세 정보 안내 (hover 시 툴팁으로 표시) */}
                  {hasDetailInfo && (
                    <div style={{
                      marginTop: 8,
                      fontSize: 11,
                      color: "#6c757d",
                      fontStyle: "italic"
                    }}>
                      💡 마우스를 올리면 상세 정보를 확인할 수 있습니다.
                    </div>
                  )}
                </div>

                {/* 메타데이터 출처 안내 */}
                {m?.auto_generated && (
                  <div style={{
                    padding: "12px",
                    backgroundColor: "#fff3cd",
                    borderRadius: "6px",
                    border: "1px solid #ffc107",
                    fontSize: 12,
                    color: "#856404"
                  }}>
                    <strong>⚠️ 자동 생성 메타데이터</strong><br />
                    이 컬럼의 메타데이터는 패턴 매칭으로 자동 생성되었습니다. <code>global_columns.yaml</code>에 직접 추가하면 더 정확한 설명을 제공할 수 있습니다.
                  </div>
                )}
              </div>
            );
          })()
        )}
      </div>

      <h2>통계 결과</h2>
      {stats ? (
        <div className="stats-content">
          {Object.entries(stats.metrics).map(([col, metric]) => (
            <div key={col} className="metric-card">
              <h3>{col}</h3>
              {metric.error ? (
                <div className="error">오류: {metric.error}</div>
              ) : (
                <table className="metric-table">
                  <tbody>
                    <tr>
                      <td>개수:</td>
                      <td>{metric.count?.toLocaleString() ?? '—'}</td>
                    </tr>
                    <tr>
                      <td>비어있지 않음:</td>
                      <td>{metric.non_null_count?.toLocaleString() ?? '—'}</td>
                    </tr>
                    <tr>
                      <td>최소값:</td>
                      <td>{metric.min?.toLocaleString() ?? '—'}</td>
                    </tr>
                    <tr>
                      <td>최대값:</td>
                      <td>{metric.max?.toLocaleString() ?? '—'}</td>
                    </tr>
                    <tr>
                      <td>평균:</td>
                      <td>{metric.avg?.toFixed(2) ?? '—'}</td>
                    </tr>
                    <tr>
                      <td>표준편차:</td>
                      <td>{metric.stddev?.toFixed(2) ?? '—'}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          그리드에서 행을 드래그하여 범위를 선택한 후<br />
          "통계 계산" 버튼을 클릭하세요.
        </div>
      )}
    </div>
  );
}

export default StatsPanel;
