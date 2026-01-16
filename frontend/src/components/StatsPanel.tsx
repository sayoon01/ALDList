import { useState, useEffect } from "react";
import { ColumnMeta, StatsResponse, buildProfile, readProfile, buildDoc, readDoc } from "../api";
import "./StatsPanel.css";

interface StatsPanelProps {
  activeColumn: string | null;
  columnMeta: Record<string, ColumnMeta>;
  stats: StatsResponse | null;
  profileText: string | null;
  docText: string | null;
  selectedDatasetId: string | null;
  onToast: (msg: string, type?: "info" | "error") => void;
}

function fmtNum(v: any) {
  if (v == null || v === "") return "—";
  if (typeof v === "number") return Number.isFinite(v) ? v.toLocaleString() : "—";
  return String(v);
}

function fmtFloat(v: any, digits = 2) {
  if (v == null || v === "") return "—";
  if (typeof v === "number") return Number.isFinite(v) ? v.toFixed(digits) : "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

export default function StatsPanel({
  activeColumn,
  columnMeta,
  stats,
  profileText,
  docText,
  selectedDatasetId,
  onToast,
}: StatsPanelProps) {
  const [profileJson, setProfileJson] = useState<any>(null);
  const [docMd, setDocMd] = useState<string>("");
  const [isBuildingProfile, setIsBuildingProfile] = useState(false);
  const [isBuildingDoc, setIsBuildingDoc] = useState(false);

  // profileText가 변경되면 파싱해서 저장
  useEffect(() => {
    if (profileText) {
      try {
        const prof = typeof profileText === "string" ? JSON.parse(profileText) : profileText;
        setProfileJson(prof);
      } catch {
        setProfileJson(null);
      }
    } else {
      setProfileJson(null);
    }
  }, [profileText]);

  // docText가 변경되면 저장
  useEffect(() => {
    setDocMd(docText || "");
  }, [docText]);

  const activeMetric = stats && activeColumn ? stats.metrics?.[activeColumn] : null;

  const totalMetricCount = stats ? Object.keys(stats.metrics || {}).length : 0;

  // semantic_type 추출
  let activeSemanticType: string | null = null;
  try {
    if (profileJson && activeColumn) {
      const columns = profileJson.columns || {};
      const col = columns[activeColumn];
      // semantic_type은 객체 형태: { type: "numeric", confidence: 1.0, ... }
      activeSemanticType = col?.semantic_type?.type ?? null;
    }
  } catch {
    activeSemanticType = null;
  }

  const handleBuildProfile = async () => {
    if (!selectedDatasetId) return;
    try {
      setIsBuildingProfile(true);
      await buildProfile(selectedDatasetId);
      onToast("Profile 빌드 완료");
      const p = await readProfile(selectedDatasetId);
      setProfileJson(p);
    } catch (error: any) {
      onToast(error.message || "Profile 빌드 실패", "error");
    } finally {
      setIsBuildingProfile(false);
    }
  };

  const handleBuildDoc = async () => {
    if (!selectedDatasetId) return;
    try {
      setIsBuildingDoc(true);
      await buildDoc(selectedDatasetId);
      onToast("Doc 빌드 완료");
      const md = await readDoc(selectedDatasetId);
      setDocMd(md);
    } catch (error: any) {
      onToast(error.message || "Doc 빌드 실패", "error");
    } finally {
      setIsBuildingDoc(false);
    }
  };

  return (
    <div className="stats-panel">
      {/* ===== 컬럼 상세 ===== */}
      <div className="sp-section">
        <div className="sp-title">컬럼 상세</div>

        {!activeColumn ? (
          <div className="sp-empty">
            💡 그리드 헤더를 클릭하거나 왼쪽에서 컬럼을 선택하면 상세 정보를 확인할 수 있습니다.
          </div>
        ) : (
          (() => {
            const m = columnMeta[activeColumn];
            const title = m?.title ?? activeColumn;

            const detailInfo: string[] = [];
            if (m?.type) detailInfo.push(`유형: ${m.type}`);
            if (m?.category) detailInfo.push(`구분: ${m.category}`);
            if (m?.unit) detailInfo.push(`단위: ${m.unit}`);
            if (m?.equipment_field) detailInfo.push(`장비 필드명: ${m.equipment_field}`);

            return (
              <div className="sp-card">
                <div className="sp-col-head">
                  <div className="sp-col-title">{title}</div>
                  <div className="sp-col-code">{activeColumn}</div>
                </div>

                {m?.desc ? (
                  <div className="sp-desc">{m.desc}</div>
                ) : (
                  <div className="sp-desc muted">
                    설명이 없습니다.
                    {m?.auto_generated && (
                      <div className="sp-mini">
                        💡<code>global_columns.yaml</code>에 추가하면 더 자세한 설명을 제공할 수 있습니다.
                      </div>
                    )}
                  </div>
                )}

                {detailInfo.length > 0 && (
                  <div className="sp-kv">
                    {detailInfo.map((t, i) => (
                      <div key={i} className="sp-kv-item">
                        {t}
                      </div>
                    ))}
                  </div>
                )}

                {activeSemanticType && (
                  <div className="sp-kv">
                    <div className="sp-kv-item">
                      semantic_type(관찰): <strong>{activeSemanticType}</strong>
                    </div>
                  </div>
                )}

                {(m?.name_ko || m?.name_en || m?.importance) && (
                  <div className="sp-meta">
                    {(m?.name_ko || m?.name_en) && (
                      <div className="sp-names">
                        {m?.name_ko && <span>{m.name_ko}</span>}
                        {m?.name_ko && m?.name_en && <span className="sp-sep">/</span>}
                        {m?.name_en && <span className="sp-en">{m.name_en}</span>}
                      </div>
                    )}
                    {m?.importance && <span className={`sp-badge imp-${m.importance}`}>중요도 {m.importance}</span>}
                  </div>
                )}

                {m?.auto_generated && (
                  <div className="sp-warn">
                    <strong>⚠️ 자동 생성 메타데이터</strong>
                    <div className="sp-mini">
                      이 컬럼 메타데이터는 패턴 매칭으로 자동 생성되었습니다.<code>global_columns.yaml</code>에 직접 추가하면 더 정확해집니다.
                    </div>
                  </div>
                )}
              </div>
            );
          })()
        )}
      </div>

      {/* ===== 통계 결과 ===== */}
      <div className="sp-section">
        <div className="sp-title">통계 결과</div>

        {!stats ? (
          <div className="sp-empty">
            그리드에서 행을 드래그하여 범위를 선택한 후 "통계 계산"을 누르세요.
          </div>
        ) : (
          <>
            {/* 요약 카드 */}
            <div className="sp-summary">
              <div className="sp-summary-card">
                <div className="k">계산된 컬럼</div>
                <div className="v">{fmtNum(totalMetricCount)}개</div>
              </div>

              <div className="sp-summary-card">
                <div className="k">활성 컬럼</div>
                <div className="v">{activeColumn ? (columnMeta[activeColumn]?.title ?? activeColumn) : "—"}</div>
              </div>

              <div className="sp-summary-card">
                <div className="k">활성 컬럼 count</div>
                <div className="v">{activeMetric?.count != null ? fmtNum(activeMetric.count) : "—"}</div>
              </div>
            </div>

            <div className="stats-content">
              {Object.entries(stats.metrics).map(([col, metric]) => (
                <div key={col} className={`metric-card ${activeColumn === col ? "active" : ""}`}>
                  <div className="metric-head">
                    <div className="metric-title">{columnMeta[col]?.title ?? col}</div>
                    <div className="metric-code">{col}</div>
                  </div>

                  {metric.error ? (
                    <div className="error">오류: {metric.error}</div>
                  ) : (
                    <table className="metric-table">
                      <tbody>
                        <tr>
                          <td className="k">개수</td>
                          <td className="v">{fmtNum(metric.count)}</td>
                        </tr>
                        <tr>
                          <td className="k">비어있지 않음</td>
                          <td className="v">{fmtNum(metric.non_null_count)}</td>
                        </tr>
                        <tr>
                          <td className="k">최소값</td>
                          <td className="v">{fmtNum(metric.min)}</td>
                        </tr>
                        <tr>
                          <td className="k">최대값</td>
                          <td className="v">{fmtNum(metric.max)}</td>
                        </tr>
                        <tr>
                          <td className="k">평균</td>
                          <td className="v">{fmtFloat(metric.avg)}</td>
                        </tr>
                        <tr>
                          <td className="k">표준편차</td>
                          <td className="v">{fmtFloat(metric.stddev)}</td>
                        </tr>
                      </tbody>
                    </table>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Profile / Doc 빌드 */}
      <div className="sp-section">
        <div className="sp-title">Profile / Doc</div>
        <div className="sp-card">
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button
              className="btn-small"
              disabled={!selectedDatasetId || isBuildingProfile}
              onClick={handleBuildProfile}
            >
              {isBuildingProfile ? "빌드 중..." : "Profile 빌드"}
            </button>
            <button
              className="btn-small"
              disabled={!selectedDatasetId || isBuildingDoc}
              onClick={handleBuildDoc}
            >
              {isBuildingDoc ? "빌드 중..." : "Doc 빌드"}
            </button>
          </div>

          {profileJson && (
            <div style={{ marginBottom: 12, fontSize: 12 }}>
              <div style={{ marginBottom: 4 }}>
                <strong>sample_rows_used</strong>: {profileJson.sample?.rows || profileJson.sample_rows_used || "—"}
              </div>
              <div style={{ marginBottom: 4 }}>
                <strong>row_count_estimate</strong>:{" "}
                {profileJson.row_count_estimate != null
                  ? profileJson.row_count_estimate.toLocaleString()
                  : "—"}
              </div>
              <div style={{ marginBottom: 4 }}>
                <strong>columns</strong>:{" "}
                {profileJson.column_count ||
                  (profileJson.columns ? Object.keys(profileJson.columns).length : "—")}
              </div>
            </div>
          )}

          {docMd && (
            <div
              style={{
                whiteSpace: "pre-wrap",
                fontSize: 11,
                lineHeight: 1.5,
                maxHeight: 320,
                overflow: "auto",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: 12,
                background: "#f9fafb",
                color: "#374151",
                fontFamily: "var(--mono)",
              }}
            >
              {docMd}
            </div>
          )}
        </div>
      </div>

      {/* Doc Preview (기존 docText가 있으면 표시) */}
      {docText && !docMd && (
        <div className="sp-section">
          <div className="sp-title">Doc Preview</div>
          <div className="sp-card">
            <pre
              style={{
                whiteSpace: "pre-wrap",
                fontFamily: "var(--mono)",
                fontSize: 11,
                lineHeight: 1.5,
                maxHeight: 300,
                overflow: "auto",
                background: "#f9fafb",
                padding: 12,
                borderRadius: 10,
                border: "1px solid var(--border)",
                margin: 0,
                color: "#374151",
              }}
            >
              {docText}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
