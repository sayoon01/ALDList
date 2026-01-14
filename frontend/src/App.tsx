import { useState, useEffect } from 'react';
import { getDatasets, getPreview, getStats, fetchDatasetColumns, Dataset, StatsResponse, ColumnMeta } from './api';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import DataGrid from './components/DataGrid';
import StatsPanel from './components/StatsPanel';
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
  // 컬럼 검색 필터
  const [columnSearchQuery, setColumnSearchQuery] = useState<string>('');
  // 타입 필터
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string | null>(null);

  // 데이터셋 목록 로드
  useEffect(() => {
    getDatasets()
      .then((res) => {
        console.log('데이터셋 목록 로드 성공:', res);
        setDatasets(res.datasets);
        if (res.datasets.length > 0) {
          setSelectedDatasetId(res.datasets[0].dataset_id);
        }
      })
      .catch((error) => {
        console.error('데이터셋 목록 로드 실패:', error);
        console.error('에러 상세:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
        // alert 대신 콘솔에만 표시 (사용자 경험 개선)
        // alert('데이터셋 목록을 불러오는 중 오류가 발생했습니다: ' + error.message);
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
          
          console.log('컬럼 로드:', { 
            totalColumns: keys.length, 
            visibleColumnsCount: visibleColumns.length,
            prevDatasetId,
            selectedDatasetId
          });
          
          // 데이터셋이 변경되었거나 컬럼이 없을 때만 초기화
          if (prevDatasetId !== selectedDatasetId || visibleColumns.length === 0) {
            // 새 데이터셋이거나 처음 로드 시: 첫 번째 컬럼 자동 선택
            const initialColumns = keys.length > 0 ? [keys[0]] : [];
            console.log('초기 컬럼 선택:', initialColumns);
            setVisibleColumns(initialColumns);
            setPrevDatasetId(selectedDatasetId);
            // activeColumn 초기값 (첫 컬럼)
            setActiveColumn(keys.length > 0 ? keys[0] : null);
          } else {
            // 같은 데이터셋이면 기존 선택 유지 (새로 추가된 컬럼만 추가)
            const newColumns = keys.filter(k => !visibleColumns.includes(k));
            const removedColumns = visibleColumns.filter(k => !keys.includes(k));
            
            // 유효한 컬럼만 유지
            let updatedColumns = visibleColumns.filter(k => keys.includes(k));
            
            if (newColumns.length > 0 || removedColumns.length > 0) {
              // 유효한 컬럼만 유지하고 새 컬럼 추가
              setVisibleColumns([
                ...updatedColumns,
                ...newColumns
              ]);
            }
            // 선택 컬럼이 사라졌으면 대체
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
            // 타입 필터 초기화
            setSelectedTypeFilter(null);
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
          // 클릭 시 상세 정보를 보려면 헤더를 클릭하세요
          headerTooltip: headerTooltip ? `${headerTooltip}\n\n💡 클릭하면 상세 정보를 확인할 수 있습니다.` : `💡 클릭하면 상세 정보를 확인할 수 있습니다.`,
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
          // 헤더 클릭 가능 표시를 위한 스타일
          headerClass: 'clickable-header',
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
    if (!selectedDatasetId) return;

    // 컬럼이 선택되지 않았으면 경고
    if (visibleColumns.length === 0) {
      alert('통계 계산을 하려면 최소한 컬럼 1개를 선택해주세요.');
      return;
    }

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

  // 그리드 헤더 클릭 시 컬럼 상세 패널로 이동
  const onColumnHeaderClicked = (params: any) => {
    if (params.column && params.column.getColId()) {
      const columnId = params.column.getColId();
      if (allColumns.includes(columnId)) {
        setActiveColumn(columnId);
        // 왼쪽 컬럼 리스트에서도 선택 상태 반영을 위해 스크롤
        const element = document.querySelector(`[data-column="${columnId}"]`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    }
  };

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

  const handleDatasetChange = (datasetId: string) => {
    setSelectedDatasetId(datasetId);
    setPrevDatasetId('');
    setOffset(0);
    setRowRange(null);
    setManualRowStart(0);
    setManualRowEnd(0);
    setStats(null);
    setColumnSearchQuery('');
    setSelectedTypeFilter(null);
  };

  return (
    <div className="app">
      <Header />

      <div className="app-content">
        <Sidebar
          datasets={datasets}
          selectedDatasetId={selectedDatasetId}
          onDatasetChange={handleDatasetChange}
          offset={offset}
          limit={limit}
          onOffsetChange={setOffset}
          onLimitChange={setLimit}
          manualRowStart={manualRowStart}
          manualRowEnd={manualRowEnd}
          onManualRowStartChange={setManualRowStart}
          onManualRowEndChange={setManualRowEnd}
          rowRange={rowRange}
          onRowRangeReset={() => {
            setManualRowStart(0);
            setManualRowEnd(0);
          }}
          statsComputeMode={statsComputeMode}
          onStatsComputeModeChange={setStatsComputeMode}
          visibleColumns={visibleColumns}
          allColumns={allColumns}
          columnMeta={columnMeta}
          activeColumn={activeColumn}
          onVisibleColumnsChange={setVisibleColumns}
          onActiveColumnChange={setActiveColumn}
          columnSearchQuery={columnSearchQuery}
          onColumnSearchQueryChange={setColumnSearchQuery}
          selectedTypeFilter={selectedTypeFilter}
          onSelectedTypeFilterChange={setSelectedTypeFilter}
          isLoadingStats={isLoadingStats}
          onCalculateStats={handleCalculateStats}
        />

        <DataGrid
          isLoading={isLoading}
          columnDefs={columnDefs}
          rowData={rowData}
          rowRange={rowRange}
          onGridReady={setGridApi}
          onCellMouseDown={onCellMouseDown}
          onCellMouseOver={onCellMouseOver}
          onColumnHeaderClicked={onColumnHeaderClicked}
          getRowStyle={getRowStyle}
        />

        <StatsPanel
          activeColumn={activeColumn}
          columnMeta={columnMeta}
          stats={stats}
        />
      </div>
    </div>
  );
}

export default App;

