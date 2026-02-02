# 프론트엔드 핵심 코드 정리

## 1. 메인 앱 컴포넌트

### 파일 위치
`frontend/src/App.tsx`

### 전체 코드

```tsx
import { useState } from "react";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import DataGrid from "./components/DataGrid";
import StatsPanel from "./components/StatsPanel";
import ToastBanner, { ToastType } from "./components/ToastBanner";
import "./App.css";
import { useAldController } from "./hooks/useAldController";

export default function App() {
  const c = useAldController();
  
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastType, setToastType] = useState<ToastType>("info");
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);

  const showError = (msg: string) => {
    setToastType("error");
    setToastMsg(msg);
  };

  return (
    <div className="app">
      <Header />
      <ToastBanner
        message={toastMsg}
        type={toastType}
        onClose={() => setToastMsg(null)}
      />

      <div className="app-content">
        <Sidebar
          datasets={c.datasets}
          selectedDatasetId={c.selectedDatasetId}
          onDatasetChange={(id) => {
            setShowSelectedOnly(false);
            c.handleDatasetChange(id);
          }}
          offset={c.offset}
          limit={c.limit}
          onOffsetChange={c.setOffset}
          onLimitChange={c.setLimit}
          manualRowStart={c.manualRowStart}
          manualRowEnd={c.manualRowEnd}
          onManualRowStartChange={c.setManualRowStart}
          onManualRowEndChange={c.setManualRowEnd}
          rowRange={c.rowRange}
          onRowRangeReset={() => {
            c.setManualRowStart(0);
            c.setManualRowEnd(0);
          }}
          statsComputeMode={c.statsComputeMode}
          onStatsComputeModeChange={c.setStatsComputeMode}
          visibleColumns={c.visibleColumns}
          allColumns={c.allColumns}
          columnMeta={c.columnMeta}
          activeColumn={c.activeColumn}
          onVisibleColumnsChange={c.setVisibleColumns}
          onActiveColumnChange={c.setActiveColumn}
          columnSearchQuery={c.columnSearchQuery}
          onColumnSearchQueryChange={c.setColumnSearchQuery}
          selectedTypeFilter={c.selectedTypeFilter}
          onSelectedTypeFilterChange={c.setSelectedTypeFilter}
          allowedTypes={c.allowedTypes}
          metaTypes={c.metaTypes}
          orderedTypes={c.orderedTypes}
          metaTypeLabels={c.typeLabels}
          isLoadingStats={c.isLoadingStats}
          onCalculateStats={() => {
            c.handleCalculateStats().catch((e) => {
              console.error(e);
              showError(e.message || "통계 계산 중 오류가 발생했습니다.");
            });
          }}
          showSelectedOnly={showSelectedOnly}
          onShowSelectedOnlyChange={setShowSelectedOnly}
        />

        {/* ✅ STEP1에서 추가한 래핑 유지 */}
        <div className="grid-wrap">
          <DataGrid
            isLoading={c.isLoading}
            columnDefs={c.columnDefs}
            rowData={c.rowData}
            rowRange={c.rowRange}
            onGridReady={c.setGridApi}
            onCellMouseDown={c.onCellMouseDown}
            onCellMouseOver={c.onCellMouseOver}
            onColumnHeaderClicked={c.onColumnHeaderClicked}
          />
        </div>

        <StatsPanel
          activeColumn={c.activeColumn}
          columnMeta={c.columnMeta}
          stats={c.stats}
          profile={c.profile}
          docMd={c.docMd}
          selectedDatasetId={c.selectedDatasetId || null}
          adminBusy={c.adminBusy}
          onBuildProfile={async (id) => {
            try {
              await c.buildAndLoadProfile(id);
              setToastType("info");
              setToastMsg("Profile 빌드 완료");
            } catch (e: any) {
              setToastType("error");
              setToastMsg(e.message || "Profile 빌드 실패");
            }
          }}
          onBuildDoc={async (id) => {
            try {
              await c.buildAndLoadDoc(id);
              setToastType("info");
              setToastMsg("Doc 빌드 완료");
            } catch (e: any) {
              setToastType("error");
              setToastMsg(e.message || "Doc 빌드 실패");
            }
          }}
          onToast={(msg, type) => {
            setToastType((type || "info") as ToastType);
            setToastMsg(msg);
          }}
        />
      </div>
    </div>
  );
}
```

### 주요 특징

- **커스텀 훅 사용**: `useAldController()`로 모든 상태와 로직을 중앙 관리
- **3단 레이아웃**: `Sidebar` (왼쪽) + `DataGrid` (중앙) + `StatsPanel` (오른쪽)
- **Toast 알림**: 에러/정보 메시지 표시
- **Props 전달**: 컨트롤러에서 관리하는 모든 상태를 각 컴포넌트에 전달

---

## 2. 핵심 컴포넌트들

### 2.1. Sidebar (데이터셋 목록 + 컬럼 목록)

#### 파일 위치
`frontend/src/components/Sidebar.tsx`

#### 주요 기능

1. **데이터셋 선택**: 드롭다운으로 CSV 파일 선택
2. **화면 표시 범위**: offset/limit 설정
3. **통계 계산 범위**: 수동 입력 또는 드래그 선택
4. **컬럼 선택**: 체크박스로 표시할 컬럼 선택
5. **타입 필터**: 타입별 컬럼 필터링 (gas, temperature, pressure 등)
6. **컬럼 검색**: 컬럼명/설명으로 검색

#### 핵심 코드 구조

```tsx
export default function Sidebar(props: SidebarProps) {
  const {
    datasets,
    selectedDatasetId,
    onDatasetChange,
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
    // ... 기타 props
  } = props;

  // 타입별 컬럼 필터링
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

  // 타입 카운트 계산
  const typeCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of allColumns) {
      const t = columnMeta[c]?.type;
      if (!t) continue;
      m[t] = (m[t] || 0) + 1;
    }
    return m;
  }, [allColumns, columnMeta]);

  return (
    <div className="sidebar">
      {/* 현재 데이터셋 표시 */}
      <div className="sb-sticky-top">
        <div className="sb-current">
          <div className="sb-current-title">현재 데이터셋</div>
          <div className="sb-current-name">{selectedDs ? selectedDs.filename : "—"}</div>
        </div>
      </div>

      <div className="sb-scroll">
        {/* 데이터셋 선택 */}
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

        {/* 컬럼 선택 */}
        <Section id="columnSelect" title="컬럼 선택">
          {/* 타입 필터 */}
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
                      // Fallback: 로컬 메타데이터로 필터링
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

          {/* 컬럼 검색 */}
          <input
            type="text"
            placeholder="🔍 컬럼 검색..."
            value={columnSearchQuery}
            onChange={(e) => onColumnSearchQueryChange(e.target.value)}
            className="sb-search"
          />

          {/* 컬럼 리스트 */}
          <div className="column-list-wrap">
            <div className="column-list">
              {filteredColumns.map((col) => {
                const m = columnMeta[col];
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
```

#### 주요 Props

- `datasets`: 데이터셋 목록
- `selectedDatasetId`: 현재 선택된 데이터셋 ID
- `visibleColumns`: 표시할 컬럼 목록
- `allColumns`: 전체 컬럼 목록
- `columnMeta`: 컬럼 메타데이터 (타입, 설명 등)
- `activeColumn`: 현재 활성화된 컬럼
- `selectedTypeFilter`: 선택된 타입 필터
- `metaTypes`: 서버에서 받은 타입 목록
- `metaTypeLabels`: 타입 라벨 (한글명)

---

### 2.2. DataGrid (데이터 그리드)

#### 파일 위치
`frontend/src/components/DataGrid.tsx`

#### 전체 코드

```tsx
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import './DataGrid.css';

interface DataGridProps {
  isLoading: boolean;
  columnDefs: any[];
  rowData: any[];
  rowRange: { start: number; end: number } | null;
  onGridReady: (api: any) => void;
  onCellMouseDown: (params: any) => void;
  onCellMouseOver: (params: any) => void;
  onColumnHeaderClicked: (params: any) => void;
}

function DataGrid({
  isLoading,
  columnDefs,
  rowData,
  rowRange,
  onGridReady,
  onCellMouseDown,
  onCellMouseOver,
  onColumnHeaderClicked,
}: DataGridProps) {
  return (
    <div className="main-content">
      {isLoading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>데이터를 불러오는 중...</p>
        </div>
      ) : (
        <div className="ag-theme-alpine" style={{ height: '100%', width: '100%' }}>
          {rowRange && (
            <div className="range-indicator">
              선택된 범위: {rowRange.start + 1} ~ {rowRange.end + 1}행 ({rowRange.end - rowRange.start + 1}개 행)
            </div>
          )}
          <AgGridReact
            columnDefs={columnDefs}
            rowData={rowData}
            defaultColDef={{
              flex: 1,
              minWidth: 120,
            }}
            onGridReady={(params) => onGridReady(params.api)}
            onCellMouseDown={onCellMouseDown}
            onCellMouseOver={onCellMouseOver}
            onColumnHeaderClicked={onColumnHeaderClicked}
            rowClassRules={{
              "row-in-range": (p) =>
                !!rowRange &&
                p.node.rowIndex != null &&
                p.node.rowIndex >= rowRange.start &&
                p.node.rowIndex <= rowRange.end,
              "row-in-range-start": (p) =>
                !!rowRange && p.node.rowIndex != null && p.node.rowIndex === rowRange.start,
              "row-in-range-end": (p) =>
                !!rowRange && p.node.rowIndex != null && p.node.rowIndex === rowRange.end,
            }}
            rowSelection="multiple"
            animateRows={true}
            suppressRowClickSelection={true}
            tooltipShowDelay={500}
            tooltipHideDelay={1000}
            enableBrowserTooltips={true}
          />
        </div>
      )}
    </div>
  );
}

export default DataGrid;
```

#### 주요 기능

- **AG Grid 사용**: `ag-grid-react` 라이브러리 사용
- **드래그 선택**: `onCellMouseDown`, `onCellMouseOver`로 행 범위 선택
- **범위 표시**: 선택된 범위를 시각적으로 강조 (`rowClassRules`)
- **컬럼 헤더 클릭**: `onColumnHeaderClicked`로 활성 컬럼 변경
- **로딩 상태**: 데이터 로딩 중 스피너 표시

---

### 2.3. StatsPanel (통계 패널)

#### 파일 위치
`frontend/src/components/StatsPanel.tsx`

#### 주요 기능

1. **컬럼 상세 정보**: 활성 컬럼의 메타데이터 표시
2. **통계 결과**: 계산된 통계 메트릭 표시 (count, min, max, avg, stddev)
3. **Profile/Doc 빌드**: Profile과 Doc 빌드 버튼 및 결과 표시

#### 핵심 코드 구조

```tsx
export default function StatsPanel({
  activeColumn,
  columnMeta,
  stats,
  profile,
  docMd,
  selectedDatasetId,
  adminBusy,
  onBuildProfile,
  onBuildDoc,
  onToast,
}: StatsPanelProps) {
  const activeMetric = stats && activeColumn ? stats.metrics?.[activeColumn] : null;
  const totalMetricCount = stats ? Object.keys(stats.metrics || {}).length : 0;

  // semantic_type 추출
  let activeSemanticType: string | null = null;
  try {
    if (profile && activeColumn) {
      const columns = profile.columns || {};
      const col = columns[activeColumn];
      activeSemanticType = col?.semantic_type?.type ?? null;
    }
  } catch {
    activeSemanticType = null;
  }

  return (
    <div className="stats-panel">
      {/* 컬럼 상세 */}
      <div className="sp-section">
        <div className="sp-title">컬럼 상세</div>
        {!activeColumn ? (
          <div className="sp-empty">
            💡 그리드 헤더를 클릭하거나 왼쪽에서 컬럼을 선택하면 상세 정보를 확인할 수 있습니다.
          </div>
        ) : (
          <div className="sp-card">
            <div className="sp-col-head">
              <div className="sp-col-title">{columnMeta[activeColumn]?.title ?? activeColumn}</div>
              <div className="sp-col-code">{activeColumn}</div>
            </div>
            {columnMeta[activeColumn]?.desc && (
              <div className="sp-desc">{columnMeta[activeColumn].desc}</div>
            )}
            {/* 메타데이터 표시 */}
            <div className="sp-kv">
              {columnMeta[activeColumn]?.type && (
                <div className="sp-kv-item">유형: {columnMeta[activeColumn].type}</div>
              )}
              {columnMeta[activeColumn]?.unit && (
                <div className="sp-kv-item">단위: {columnMeta[activeColumn].unit}</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 통계 결과 */}
      <div className="sp-section">
        <div className="sp-title">통계 결과</div>
        {!stats ? (
          <div className="sp-empty">
            그리드에서 행을 드래그하여 범위를 선택한 후 "통계 계산"을 누르세요.
          </div>
        ) : (
          <>
            <div className="sp-summary">
              <div className="sp-summary-card">
                <div className="k">계산된 컬럼</div>
                <div className="v">{totalMetricCount}개</div>
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
          <button
            className="btn-small"
            disabled={!selectedDatasetId || adminBusy}
            onClick={() => onBuildProfile(selectedDatasetId!)}
          >
            {adminBusy ? "빌드 중..." : "Profile 빌드"}
          </button>
          {/* Profile/Doc 내용 표시 */}
        </div>
      </div>
    </div>
  );
}
```

---

## 3. API 호출 유틸리티

### 파일 위치
`frontend/src/api.ts`

### 전체 코드

```typescript
/** API 클라이언트 */

// 환경 변수에서 API 베이스 URL 가져오기
// 개발 환경: 비워두면 Vite 프록시 사용 (/api -> http://localhost:8000)
// 프로덕션: VITE_API_BASE 환경 변수 설정 (예: https://aldlist-backend-production.up.railway.app)
const API_BASE = import.meta.env.VITE_API_BASE ?? '';

export interface Dataset {
  dataset_id: string;
  filename: string;
  size_bytes: number;
  columns: string[];
}

export interface PreviewResponse {
  dataset_id: string;
  offset: number;
  limit: number;
  columns: string[];
  rows: Record<string, any>[];
  row_count: number;
}

export interface Metric {
  count?: number;
  non_null_count?: number;
  min?: number;
  max?: number;
  avg?: number;
  stddev?: number;
  error?: string;
}

export interface StatsResponse {
  metrics: Record<string, Metric>;
}

export interface ColumnMeta {
  key: string;
  title?: string;
  desc?: string;
  unit?: string;
  type?: string;
  category?: string;
  equipment_field?: string;
  importance?: "A" | "B" | "C";
  name_ko?: string;
  name_en?: string;
  auto_generated?: boolean;
}

export interface DatasetColumnsResponse {
  dataset_id: string;
  columns: string[];
  meta: Record<string, ColumnMeta>;
}

// ===== 내부 유틸리티 함수 =====

async function fetchAPI<T>(endpoint: string): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);

      // ✅ JSON 에러(detail dict)면 파싱해서 message를 더 보기 좋게
      try {
        const j = JSON.parse(text);
        const detail = j?.detail;

        // detail이 객체면 message + allowed_types를 붙여줌
        if (detail && typeof detail === "object") {
          const msg = detail.message || `API Error (${response.status})`;
          const allowed = Array.isArray(detail.allowed_types) ? detail.allowed_types.join(", ") : null;
          throw new Error(allowed ? `${msg}\nAllowed: ${allowed}` : msg);
        }

        // detail이 문자열이면 그대로
        if (typeof detail === "string") {
          throw new Error(detail);
        }

        throw new Error(text);
      } catch {
        throw new Error(`API Error (${response.status}): ${text}`);
      }
    }
    return response.json();
  } catch (error: any) {
    if (error instanceof TypeError && error.message === 'Load failed') {
      throw new Error(`네트워크 오류: 백엔드 서버에 연결할 수 없습니다. 백엔드가 http://localhost:8000에서 실행 중인지 확인하세요.`);
    }
    throw error;
  }
}

async function postAPI<T>(endpoint: string, body: any): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }
  return response.json();
}

// ===== 공개 API 함수 =====

export async function getDatasets(): Promise<{ datasets: Dataset[] }> {
  return fetchAPI('/api/datasets');
}

export async function getPreview(
  datasetId: string,
  offset: number = 0,
  limit: number = 2000
): Promise<PreviewResponse> {
  return fetchAPI(`/api/datasets/${datasetId}/preview?offset=${offset}&limit=${limit}`);
}

export async function getStats(
  datasetId: string,
  columns: string[],
  rowStart?: number,
  rowEnd?: number,
  computeColumns?: string[]  // 확장 포인트: 선택적으로 일부 컬럼만 계산 (없으면 columns 전체)
): Promise<StatsResponse> {
  return postAPI(`/api/datasets/${datasetId}/stats`, {
    columns,
    row_range: rowStart !== undefined || rowEnd !== undefined
      ? { start: rowStart ?? 0, end: rowEnd ?? null }
      : null,
    compute_columns: computeColumns || undefined,  // 선택적 파라미터 (없으면 전체 columns 사용)
  });
}

export async function fetchDatasetColumns(datasetId: string): Promise<DatasetColumnsResponse> {
  return fetchAPI(`/api/datasets/${datasetId}/columns`);
}

export interface FieldsByTypeResponse {
  dataset_id: string;
  type: string;
  count: number;
  columns: string[];
  meta: Record<string, ColumnMeta>;
}

export async function getFieldsByType(datasetId: string, type: string): Promise<FieldsByTypeResponse> {
  return fetchAPI(`/api/datasets/${datasetId}/fields?type=${encodeURIComponent(type)}`);
}

export interface AllowedTypesResponse {
  types: string[];
}

export async function getAllowedTypes(): Promise<AllowedTypesResponse> {
  return fetchAPI("/api/meta/types");
}

export type MetaTypesResponse = {
  types: string[];
  labels: Record<string, string>;
  order: string[] | null;
};

export async function getMetaTypes(): Promise<MetaTypesResponse> {
  return fetchAPI("/api/meta/types");
}

// ===== Admin API =====

export interface AdminTextResponse {
  dataset_id: string;
  path: string;
  profile?: string;
  doc?: string;
}

async function checkResponse(res: Response) {
  if (!res.ok) {
    const errorText = await res.text().catch(() => res.statusText);
    throw new Error(`API Error (${res.status}): ${errorText}`);
  }
  return res;
}

export async function adminRefresh(force: boolean = false): Promise<any> {
  const url = `${API_BASE}/api/admin/refresh?force=${force}`;
  const res = await fetch(url, { method: "POST" });
  await checkResponse(res);
  return res.json();
}

export async function buildProfile(datasetId: string): Promise<any> {
  const url = `${API_BASE}/api/admin/profile/${datasetId}/build`;
  const res = await fetch(url, { method: "POST" });
  await checkResponse(res);
  return res.json();
}

export async function readProfile(datasetId: string): Promise<any> {
  const url = `${API_BASE}/api/admin/profile/${datasetId}`;
  const res = await fetch(url);
  await checkResponse(res);
  return res.json();
}

export async function buildDoc(
  datasetId: string,
  groupTopN?: number,
  highlightTopN?: number
): Promise<any> {
  const params = new URLSearchParams();
  if (groupTopN !== undefined) params.append("group_top_n", String(groupTopN));
  if (highlightTopN !== undefined) params.append("highlight_top_n", String(highlightTopN));
  
  const url = `${API_BASE}/api/admin/doc/${datasetId}/build${params.toString() ? `?${params.toString()}` : ""}`;
  const res = await fetch(url, { method: "POST" });
  await checkResponse(res);
  return res.json();
}

export async function readDoc(datasetId: string): Promise<string> {
  const url = `${API_BASE}/api/admin/doc/${datasetId}`;
  const res = await fetch(url);
  await checkResponse(res);
  return res.text();
}

// 기존 함수들 (하위 호환성 유지)
export async function getProfileText(datasetId: string): Promise<AdminTextResponse> {
  const profile = await readProfile(datasetId);
  return {
    dataset_id: profile.dataset_id || datasetId,
    path: profile.path || "",
    profile: JSON.stringify(profile),
  };
}

export async function getDocText(datasetId: string): Promise<AdminTextResponse> {
  const doc = await readDoc(datasetId);
  return {
    dataset_id: datasetId,
    path: "",
    doc: doc,
  };
}
```

### 주요 특징

1. **Base URL 처리**:
   - 개발 환경: `API_BASE`가 비어있으면 Vite 프록시 사용 (`/api` → `http://localhost:8000`)
   - 프로덕션: `VITE_API_BASE` 환경 변수로 설정

2. **에러 처리**:
   - FastAPI 에러 응답 파싱 (`detail` 필드 처리)
   - 네트워크 오류 시 친화적인 메시지 표시

3. **API 함수들**:
   - `getDatasets()`: 데이터셋 목록 조회
   - `getPreview()`: 데이터 미리보기
   - `getStats()`: 통계 계산
   - `fetchDatasetColumns()`: 컬럼 메타데이터 조회
   - `getFieldsByType()`: 타입별 컬럼 필터링
   - `getMetaTypes()`: 메타 타입 정보 조회
   - Admin API: Profile/Doc 빌드 및 조회

---

## 4. 상태 관리 훅

### 파일 위치
`frontend/src/hooks/useAldController.ts`

이 파일은 모든 상태와 로직을 중앙에서 관리하는 커스텀 훅입니다. 주요 기능:

- 데이터셋 목록 로드
- 데이터 미리보기 로드
- 컬럼 메타데이터 로드
- 통계 계산
- 그리드 드래그 선택 처리
- Profile/Doc 빌드 및 로드

자세한 내용은 파일을 직접 참조하세요.

---

## 파일 구조 요약

```
frontend/src/
├── App.tsx                    # 메인 앱 컴포넌트
├── api.ts                     # API 호출 유틸리티 (base URL, fetch 래퍼)
├── hooks/
│   └── useAldController.ts    # 상태 관리 훅
└── components/
    ├── Sidebar.tsx           # 데이터셋 목록 + 컬럼 목록
    ├── DataGrid.tsx          # 데이터 그리드 (AG Grid)
    ├── StatsPanel.tsx        # 통계 패널
    ├── Header.tsx            # 헤더
    └── ToastBanner.tsx       # Toast 알림
```

---

## 주요 데이터 흐름

1. **초기 로드**:
   ```
   App.tsx → useAldController → getDatasets() → API
   ```

2. **데이터셋 선택**:
   ```
   Sidebar → onDatasetChange → useAldController → getPreview() + fetchDatasetColumns() → API
   ```

3. **통계 계산**:
   ```
   Sidebar → onCalculateStats → useAldController → getStats() → API → StatsPanel 표시
   ```

4. **컬럼 선택**:
   ```
   Sidebar → onVisibleColumnsChange → useAldController → columnDefs 업데이트 → DataGrid 리렌더링
   ```
