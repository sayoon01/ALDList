import { useState, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { getDatasets, getPreview, getStats, Dataset, StatsResponse } from './api';
import './App.css';

function App() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');
  const [prevDatasetId, setPrevDatasetId] = useState<string>('');
  const [allColumns, setAllColumns] = useState<string[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [columnDefs, setColumnDefs] = useState<any[]>([]);
  const [rowData, setRowData] = useState<any[]>([]);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(2000);
  const [rowRange, setRowRange] = useState<{ start: number; end: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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

  // 선택된 데이터셋의 미리보기 로드
  useEffect(() => {
    if (!selectedDatasetId) return;

    setIsLoading(true);
    getPreview(selectedDatasetId, offset, limit)
      .then((data) => {
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
          }
          
          setRowData(data.rows);
        } else {
          // 데이터가 없을 때
          console.warn('데이터가 없습니다:', data);
          setAllColumns([]);
          setVisibleColumns([]);
          setRowData([]);
        }
      })
      .catch((error) => {
        console.error('데이터 로딩 실패:', error);
        alert('데이터를 불러오는 중 오류가 발생했습니다: ' + error.message);
        setRowData([]);
        setAllColumns([]);
        setVisibleColumns([]);
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
        
        const colDef: any = {
          headerName: k,
          filter: true,
          sortable: true,
          resizable: true,
          // 헤더 툴팁 (마우스 오버 시 전체 텍스트 표시)
          headerTooltip: k,
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
  }, [visibleColumns]);

  // 통계 계산
  const handleCalculateStats = async () => {
    if (!selectedDatasetId || !rowRange || visibleColumns.length === 0) return;

    setIsLoadingStats(true);
    try {
      const rowStart = rowRange.start;
      const rowEnd = rowRange.end + 1; // end는 inclusive이므로 +1
      const result = await getStats(selectedDatasetId, visibleColumns, rowStart, rowEnd);
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

          <div className="section">
            <h2>미리보기 범위</h2>
            <div className="input-group">
              <label>시작:</label>
              <input
                type="number"
                value={offset}
                onChange={(e) => setOffset(Number(e.target.value))}
                min="0"
                className="number-input"
              />
            </div>
            <div className="input-group">
              <label>개수:</label>
              <input
                type="number"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                min="1"
                max="10000"
                className="number-input"
              />
            </div>
            <button onClick={() => setOffset(0)} className="btn-secondary">
              처음으로
            </button>
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
                {allColumns.map((col) => (
                  <label key={col} className="column-checkbox">
                    <input
                      type="checkbox"
                      checked={visibleColumns.includes(col)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setVisibleColumns([...visibleColumns, col]);
                        } else {
                          setVisibleColumns(visibleColumns.filter((c) => c !== col));
                        }
                      }}
                    />
                    <span title={col}>{col}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="section">
            <h2>통계 계산</h2>
            {rowRange && (
              <div className="range-info">
                <strong>선택 범위:</strong> {rowRange.start} ~ {rowRange.end}행
                <br />
                <small>({rowRange.end - rowRange.start + 1}개 행)</small>
              </div>
            )}
            <button
              onClick={handleCalculateStats}
              disabled={isLoadingStats || !rowRange || visibleColumns.length === 0}
              className="btn-primary"
            >
              {isLoadingStats ? '계산 중...' : '통계 계산'}
            </button>
            {!rowRange && (
              <div className="hint-text">
                💡 그리드에서 행을 드래그하여 범위를 선택하세요
              </div>
            )}
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
                  선택된 범위: {rowRange.start} ~ {rowRange.end}행 ({rowRange.end - rowRange.start + 1}개 행)
                </div>
              )}
              <AgGridReact
                columnDefs={columnDefs}
                rowData={rowData}
                defaultColDef={{
                  flex: 1,
                  minWidth: 120,
                }}
                onCellMouseDown={onCellMouseDown}
                onCellMouseOver={onCellMouseOver}
                getRowStyle={getRowStyle}
                rowSelection="multiple"
                animateRows={true}
                suppressRowClickSelection={true}
                // 헤더 툴팁 활성화
                enableBrowserTooltips={true}
              />
            </div>
          )}
        </div>

        {/* 오른쪽 통계 패널 */}
        <div className="stats-panel">
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

