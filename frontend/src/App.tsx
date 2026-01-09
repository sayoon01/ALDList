import { useState, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { getDatasets, getPreview, getStats, fetchDatasetColumns, Dataset, StatsResponse, ColumnMeta } from './api';
import './App.css';

function App() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');
  const [prevDatasetId, setPrevDatasetId] = useState<string>('');
  const [allColumns, setAllColumns] = useState<string[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [columnDefs, setColumnDefs] = useState<any[]>([]);
  const [rowData, setRowData] = useState<any[]>([]);
  const [columnMeta, setColumnMeta] = useState<Record<string, ColumnMeta>>({});
  const [activeColumn, setActiveColumn] = useState<string | null>(null);
  const [gridApi, setGridApi] = useState<any>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(500); // 초기 로딩 속도 개선: 2000 -> 500
  const [rowRange, setRowRange] = useState<{ start: number; end: number } | null>(null);
  const [manualRowStart, setManualRowStart] = useState<number>(0);
  const [manualRowEnd, setManualRowEnd] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  // 통계 계산 모드: 'all' (전체), 'active' (활성 컬럼만), 'selected' (선택 컬럼만 - 확장 포인트)
  const [statsComputeMode, setStatsComputeMode] = useState<'all' | 'active'>('all');

  // 데이터셋 목록 로드
  useEffect(() => {
    getDatasets()
      .then((res) => {
        setDatasets(res.datasets);
        if (res.datasets.length > 0) {
          setSelectedDatasetId(res.datasets[0].dataset_id);
        }
      })
      .catch((error) => {
        console.error('데이터셋 목록 로드 실패:', error);
        alert('데이터셋 목록을 불러오는 중 오류가 발생했습니다: ' + error.message);
      });
  }, []);

  // 선택된 데이터셋의 미리보기 데이터를 먼저 로드, 메타데이터는 나중에 (UX 개선)
  useEffect(() => {
    if (!selectedDatasetId) return;

    setIsLoading(true);
    
    // 1단계: preview 먼저 로드 (표를 먼저 보여줌)
    getPreview(selectedDatasetId, offset, limit)
      .then((previewData) => {
        // 미리보기 데이터 처리
        const data = previewData;
        console.log('데이터 로드 성공:', { 
          rowCount: data.rows?.length, 
          columns: data.columns?.length,
          firstRow: data.rows?.[0] 
        });
        
        if (data.rows && data.rows.length > 0) {
          const keys = data.columns || Object.keys(data.rows[0]);
          setAllColumns(keys);
          
          // 데이터셋이 변경되었거나 컬럼이 없을 때만 초기화
          if (prevDatasetId !== selectedDatasetId || visibleColumns.length === 0) {
            // 새 데이터셋이거나 처음 로드 시: 모든 컬럼 표시
            setVisibleColumns(keys);
            setPrevDatasetId(selectedDatasetId);
            // ✅ 추가: activeColumn 초기값 (첫 컬럼)
            setActiveColumn(keys.length > 0 ? keys[0] : null);
          } else {
            // 같은 데이터셋이면 기존 선택 유지 (새로 추가된 컬럼만 추가)
            const newColumns = keys.filter(k => !visibleColumns.includes(k));
            const removedColumns = visibleColumns.filter(k => !keys.includes(k));
            if (newColumns.length > 0 || removedColumns.length > 0) {
              // 유효한 컬럼만 유지하고 새 컬럼 추가
              setVisibleColumns([
                ...visibleColumns.filter(k => keys.includes(k)),
                ...newColumns
              ]);
            }
            // ✅ 선택 컬럼이 사라졌으면 대체
            setActiveColumn((prev) => {
              if (!prev) return keys.length > 0 ? keys[0] : null;
              if (keys.includes(prev)) return prev;
              return keys.length > 0 ? keys[0] : null;
            });
          }
          
          setRowData(data.rows);
        } else {
          // 데이터가 없을 때
          console.warn('데이터가 없습니다:', data);
          setAllColumns([]);
          setVisibleColumns([]);
          setRowData([]);
        }
        
        // 2단계: 메타데이터는 나중에 로드 (표는 이미 보여줌, 툴팁/상세 패널은 나중에 채움)
        fetchDatasetColumns(selectedDatasetId)
          .then((columnsData) => {
            setColumnMeta(columnsData.meta);
          })
          .catch((error) => {
            console.error('컬럼 메타데이터 로드 실패:', error);
            // 실패해도 표는 이미 보여줌 (메타데이터 없이도 동작)
          });
      })
      .catch((error) => {
        console.error('데이터 로딩 실패:', error);
        alert('데이터를 불러오는 중 오류가 발생했습니다: ' + error.message);
        setRowData([]);
        setAllColumns([]);
        setVisibleColumns([]);
        setColumnMeta({});
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [selectedDatasetId, offset, limit]);

  // 표시할 컬럼이 변경되면 columnDefs 업데이트
  useEffect(() => {
    if (visibleColumns.length === 0) {
      setColumnDefs([]);
      return;
    }

    // rowData가 없어도 컬럼 정의는 생성 (데이터는 나중에 로드될 수 있음)
    setColumnDefs(
      visibleColumns.map((k) => {
        // 점(.)이나 특수문자가 포함된 필드명은 valueGetter 사용
        const hasSpecialChars = /[.()]/.test(k);
        
        // 메타데이터 가져오기 (항상 존재함을 전제)
        const m = columnMeta[k];
        const headerTooltip = m?.desc
          ? `${m.desc}${m.unit ? ` (${m.unit})` : ""}${m.auto_generated ? " [auto]" : ""}`
          : k;
        
        const colDef: any = {
          headerName: k,  // 원본 컬럼명 유지
          filter: true,
          sortable: true,
          resizable: true,
          // 헤더 툴팁 (메타데이터 설명 사용) - AG Grid가 자동으로 표시
          headerTooltip: headerTooltip,
          // 셀 hover 시 값 tooltip
          tooltipValueGetter: (params: any) => {
            return params.value != null ? String(params.value) : null;
          },
          // 최소 너비 설정
          minWidth: 120,
          valueFormatter: (params: any) => {
            if (params.value == null || params.value === '') return '—';
            return String(params.value);
          },
        };
        
        // 특수문자가 포함된 필드명은 valueGetter 사용, 아니면 field 사용
        if (hasSpecialChars) {
          colDef.valueGetter = (params: any) => {
            return params.data ? params.data[k] : null;
          };
        } else {
          colDef.field = k;
        }
        
        return colDef;
      })
    );
  }, [visibleColumns, columnMeta]);

  // activeColumn이 바뀌면 그리드에서 해당 컬럼으로 스크롤
  useEffect(() => {
    if (!gridApi || !activeColumn) return;
    gridApi.ensureColumnVisible(activeColumn);
  }, [gridApi, activeColumn]);

  // 활성 컬럼이 없을 때 'active' 모드 자동 전환
  useEffect(() => {
    if (statsComputeMode === 'active' && !activeColumn) {
      setStatsComputeMode('all');
    }
  }, [activeColumn, statsComputeMode]);

  // 통계 계산
  const handleCalculateStats = async () => {
    if (!selectedDatasetId || visibleColumns.length === 0) return;

    // 수동 입력 범위가 있으면 우선 사용, 없으면 드래그 선택 범위 사용
    let rowStart: number;
    let rowEnd: number;
    
    if (manualRowStart !== 0 || manualRowEnd !== 0) {
      // 수동 입력 범위 사용
      rowStart = manualRowStart;
      rowEnd = manualRowEnd + 1; // end는 inclusive이므로 +1
    } else if (rowRange) {
      // 드래그 선택 범위 사용
      rowStart = rowRange.start;
      rowEnd = rowRange.end + 1; // end는 inclusive이므로 +1
    } else {
      // 범위가 없으면 통계 계산 불가
      alert('통계 계산할 범위를 선택하거나 입력해주세요.');
      return;
    }

    setIsLoadingStats(true);
    try {
      // 통계 계산 대상 컬럼 선택 (확장 가능한 구조)
      let computeColumns: string[] | undefined;
      if (statsComputeMode === 'active' && activeColumn && visibleColumns.includes(activeColumn)) {
        // 활성 컬럼만 계산
        computeColumns = [activeColumn];
      } else if (statsComputeMode === 'all') {
        // 전체 컬럼 계산 (기본값)
        computeColumns = undefined; // undefined면 전체 visibleColumns 사용
      }
      // 확장 포인트: 'selected' 모드는 나중에 추가 가능
      
      const result = await getStats(selectedDatasetId, visibleColumns, rowStart, rowEnd, computeColumns);
      setStats(result);
    } catch (error: any) {
      console.error('통계 계산 실패:', error);
      alert('통계 계산 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'));
    } finally {
      setIsLoadingStats(false);
    }
  };

  // 행 범위 선택 (드래그)
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectStart, setSelectStart] = useState<number | null>(null);

  const onCellMouseDown = (params: any) => {
    setIsSelecting(true);
    setSelectStart(params.node.rowIndex);
    setRowRange({ start: params.node.rowIndex, end: params.node.rowIndex });
  };

  const onCellMouseOver = (params: any) => {
    if (isSelecting && selectStart !== null) {
      const start = Math.min(selectStart, params.node.rowIndex);
      const end = Math.max(selectStart, params.node.rowIndex);
      setRowRange({ start, end });
    }
  };

  useEffect(() => {
    const handleMouseUp = () => {
      if (isSelecting) {
        setIsSelecting(false);
      }
    };

    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [isSelecting]);

  // 드래그 선택 완료 시 통계 계산 범위에 자동 반영
  useEffect(() => {
    if (rowRange && !isSelecting) {
      setManualRowStart(rowRange.start);
      setManualRowEnd(rowRange.end);
    }
  }, [rowRange, isSelecting]);

  // 선택된 행 범위에 스타일 적용
  const getRowStyle = (params: any) => {
    if (rowRange) {
      const rowIndex = params.node.rowIndex;
      if (rowIndex >= rowRange.start && rowIndex <= rowRange.end) {
        return {
          backgroundColor: '#e3f2fd',
          border: '2px solid #2196f3',
        };
      }
    }
    return undefined;
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>ALDList - CSV 데이터 분석</h1>
      </header>

      <div className="app-content">
        {/* 왼쪽 사이드바 */}
        <div className="sidebar">
          <div className="section">
            <h2>데이터셋 선택</h2>
            <select
              value={selectedDatasetId}
              onChange={(e) => {
                setSelectedDatasetId(e.target.value);
                setPrevDatasetId(''); // 데이터셋 변경 시 이전 ID 초기화
                setOffset(0);
                setRowRange(null);
                setManualRowStart(0);
                setManualRowEnd(0);
                setStats(null);
                // 데이터셋 변경 시 컬럼은 자동으로 새 데이터셋의 모든 컬럼으로 설정됨
              }}
              className="select-input"
            >
              {datasets.map((ds) => (
                <option key={ds.dataset_id} value={ds.dataset_id}>
                  {ds.filename} ({ds.columns.length} 컬럼)
                </option>
              ))}
            </select>
          </div>

          <div className="section compact-section">
            <h2>화면 표시 범위</h2>
            <div className="compact-input-row">
              <div className="compact-input-group">
                <label>시작</label>
                <input
                  type="number"
                  value={offset}
                  onChange={(e) => setOffset(Number(e.target.value))}
                  min="0"
                  className="compact-input"
                />
              </div>
              <div className="compact-input-group">
                <label>개수</label>
                <input
                  type="number"
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  min="1"
                  max="10000"
                  className="compact-input"
                />
              </div>
              <button onClick={() => setOffset(0)} className="btn-compact">
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
                    setManualRowStart(Math.max(0, val));
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
                    setManualRowEnd(Math.max(0, val));
                  }}
                  min="1"
                  placeholder="1"
                  className="compact-input"
                />
              </div>
              <button 
                onClick={() => {
                  setManualRowStart(0);
                  setManualRowEnd(0);
                }} 
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
            
            {/* 통계 계산 대상 컬럼 선택 (확장 가능한 구조) */}
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
                    onChange={(e) => setStatsComputeMode(e.target.value as 'all' | 'active')}
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
                    onChange={(e) => setStatsComputeMode(e.target.value as 'all' | 'active')}
                    disabled={!activeColumn}
                    style={{ marginRight: 6 }}
                  />
                  <span>
                    활성 컬럼만 {activeColumn && `(${columnMeta[activeColumn]?.title ?? activeColumn})`}
                    {!activeColumn && '(컬럼 선택 필요)'}
                  </span>
                </label>
                {/* 확장 포인트: 'selected' 모드는 나중에 추가 가능 */}
              </div>
            </div>
            
            <button
              onClick={handleCalculateStats}
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
                    onClick={() => setVisibleColumns(allColumns)}
                    className="btn-small"
                  >
                    전체 선택
                  </button>
                  <button
                    onClick={() => setVisibleColumns([])}
                    className="btn-small"
                  >
                    모두 해제
                  </button>
                </div>
              </div>
              <div className="column-list">
                {allColumns.map((col) => {
                  const m = columnMeta[col]; // 항상 있음을 전제(없어도 안전)
                  const isChecked = visibleColumns.includes(col);
                  const isActive = activeColumn === col;

                  const tip = m?.desc
                    ? `${m.desc}${m.unit ? ` (${m.unit})` : ""}${m.auto_generated ? " [auto]" : ""}`
                    : col;

                  const labelText = m?.title ?? col;

                  return (
                    <label
                      key={col}
                      className="column-checkbox"
                      title={tip} // ✅ hover tooltip
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
                        // ✅ 체크박스와 별개로 "상세패널 선택"을 바꿈
                        setActiveColumn(col);
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const checked = e.target.checked;

                          if (checked) {
                            // 중복 방지
                            if (!visibleColumns.includes(col)) {
                              setVisibleColumns([...visibleColumns, col]);
                            }
                            // ✅ 체크하면 상세도 같이 선택되게
                            setActiveColumn(col);
                          } else {
                            const next = visibleColumns.filter((c) => c !== col);
                            setVisibleColumns(next);

                            // ✅ 지금 선택중인 컬럼을 끄면, 상세패널도 대체
                            if (activeColumn === col) {
                              setActiveColumn(next.length > 0 ? next[0] : null);
                            }
                          }
                        }}
                        onClick={(e) => {
                          // label 클릭으로 중복 이벤트 발생 방지
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
                })}
              </div>
            </div>
          </div>
        </div>

        {/* 중앙 그리드 */}
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
                onGridReady={(params) => setGridApi(params.api)}
                onCellMouseDown={onCellMouseDown}
                onCellMouseOver={onCellMouseOver}
                getRowStyle={getRowStyle}
                rowSelection="multiple"
                animateRows={true}
                suppressRowClickSelection={true}
                // 헤더 툴팁 활성화
                tooltipShowDelay={500}
                tooltipHideDelay={1000}
                enableBrowserTooltips={true}
              />
            </div>
          )}
        </div>

        {/* 오른쪽 통계 패널 */}
        <div className="stats-panel">
          <div className="section">
            <h2>컬럼 상세</h2>

            {!activeColumn ? (
              <div style={{ opacity: 0.75 }}>왼쪽에서 컬럼을 선택하세요.</div>
            ) : (
              (() => {
                const m = columnMeta[activeColumn];
                const title = m?.title ?? activeColumn;

                return (
                  <div style={{ display: "grid", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>
                        {title}
                        {m?.importance ? (
                          <span style={{ marginLeft: 8, opacity: 0.7 }}>중요도 {m.importance}</span>
                        ) : null}
                      </div>

                      {(m?.name_ko || m?.name_en) ? (
                        <div style={{ opacity: 0.75 }}>
                          {m?.name_ko ?? ""}
                          {m?.name_en ? ` / ${m.name_en}` : ""}
                        </div>
                      ) : null}
                    </div>

                    {m?.desc ? (
                      <div style={{ lineHeight: 1.4 }}>{m.desc}</div>
                    ) : (
                      <div style={{ opacity: 0.7 }}>설명 없음</div>
                    )}

                    <div style={{ display: "grid", gap: 4, opacity: 0.9 }}>
                      {m?.type ? <div>유형: {m.type}</div> : null}
                      {m?.category ? <div>구분: {m.category}</div> : null}
                      {m?.equipment_field ? <div>장비 필드명: {m.equipment_field}</div> : null}
                      {m?.unit ? <div>단위: {m.unit}</div> : null}
                      {m?.auto_generated ? (
                        <div style={{ opacity: 0.7 }}>
                          [자동 생성 메타] global_columns.yaml에 추가하면 더 정확해짐
                        </div>
                      ) : null}
                    </div>
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
      </div>
    </div>
  );
}

export default App;

