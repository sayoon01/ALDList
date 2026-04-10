import { useState, useEffect, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { getDatasets, getPreview, getStats, fetchDatasetColumns, Dataset, StatsResponse, ColumnMeta } from './api';
import { LeftTab } from './types';
import { ellipsis } from './utils/ellipsis';
import { LeftNav } from './components/LeftNav';
import { LeftPanel } from './components/LeftPanel';
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
  const [activeColumn, setActiveColumn] = useState<string>("");
  const gridApiRef = useRef<any>(null);
  const gridColumnApiRef = useRef<any>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  // 화면표시범위 기능 제거: offset, limit state 제거
  const [rowRange, setRowRange] = useState<{ start: number; end: number } | null>(null);
  const [manualRowStart, setManualRowStart] = useState<number>(0);
  const [manualRowEnd, setManualRowEnd] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  // 통계 계산 모드: 'all' (전체), 'active' (활성 컬럼만), 'selected' (선택 컬럼만 - 확장 포인트)
  const [statsComputeMode, setStatsComputeMode] = useState<'all' | 'active'>('all');
  // 컬럼 검색 필터
  const [columnSearchQuery, setColumnSearchQuery] = useState<string>('');
  // 타입 필터 (자동 생성)
  const [typeCounts, setTypeCounts] = useState<Array<{type: string; count: number}>>([]);
  const [activeType, setActiveType] = useState<string>("__all__");
  // 자연어 질의
  const [nlQuestion, setNlQuestion] = useState<string>("");
  const [nlLoading, setNlLoading] = useState<boolean>(false);
  const [nlResult, setNlResult] = useState<any>(null);
  const [nlError, setNlError] = useState<string>("");
  const [minScore, setMinScore] = useState<number>(0);
  
  // 좌측 탭 상태 관리
  const [leftTab, setLeftTab] = useState<LeftTab>("columns");
  
  // 최근 질문 기억용
  const [lastQuestion, setLastQuestion] = useState<string>("");
  
  // 접히는 섹션 상태 관리 (기존 호환성 유지)
  const [openSection, setOpenSection] = useState({
    dataset: true,      // 데이터셋: 열림
    stats: false,      // 통계: 닫힘
    nlq: true,         // 자연어 질의: 열림
    columns: true,     // 컬럼 선택: 열림
  });
  
  // 컬럼 선택 모드 (체크박스 리스트 표시 여부)
  const [showAllColumnList, setShowAllColumnList] = useState<boolean>(false);
  
  // 선택된 데이터셋 이름 계산
  const selectedDatasetName = datasets.find(ds => ds.dataset_id === selectedDatasetId)?.filename || selectedDatasetId || "No dataset";
  
  // 섹션 토글 함수
  const toggleSection = (section: keyof typeof openSection) => {
    setOpenSection(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // 통계 섹션 자동 열기 (범위 선택 시)
  useEffect(() => {
    if (rowRange || (manualRowStart !== 0 || manualRowEnd !== 0)) {
      setOpenSection(prev => ({ ...prev, stats: true }));
    }
  }, [rowRange, manualRowStart, manualRowEnd]);

  // allColumns 로딩 시 자동 선택 (표 바로 보이게)
  useEffect(() => {
    if (allColumns.length > 0 && visibleColumns.length === 0) {
      console.log('allColumns 자동 선택:', allColumns.length, '개 컬럼');
      setVisibleColumns(allColumns);
    }
  }, [allColumns, visibleColumns.length]);

  // 데이터셋 목록 로드
  useEffect(() => {
    console.log('데이터셋 목록 로드 시작...');
    getDatasets()
      .then((res) => {
        console.log('데이터셋 목록 로드 성공:', res);
        console.log('데이터셋 개수:', res.datasets?.length || 0);
        if (res.datasets && Array.isArray(res.datasets)) {
          setDatasets(res.datasets);
          if (res.datasets.length > 0) {
            console.log('첫 번째 데이터셋 선택:', res.datasets[0].dataset_id);
            setSelectedDatasetId(res.datasets[0].dataset_id);
          } else {
            console.warn('데이터셋 목록이 비어있습니다.');
          }
        } else {
          console.error('데이터셋 목록 형식이 올바르지 않습니다:', res);
          setDatasets([]);
        }
      })
      .catch((error) => {
        console.error('데이터셋 목록 로드 실패:', error);
        console.error('에러 상세:', error);
        // alert 대신 콘솔에만 출력 (사용자 경험 개선)
        setDatasets([]);
      });
  }, []);

  // 선택된 데이터셋의 미리보기 데이터를 먼저 로드, 메타데이터는 나중에 (UX 개선)
  useEffect(() => {
    if (!selectedDatasetId) return;

    setIsLoading(true);
    
    // 1단계: preview 먼저 로드 (표를 먼저 보여줌)
    getPreview(selectedDatasetId)
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
            // ✅ 추가: activeColumn 초기값 (첫 컬럼, 상세 패널 확인용)
            setActiveColumn(keys.length > 0 ? keys[0] : "");
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
              if (!prev) return keys.length > 0 ? keys[0] : "";
              if (keys.includes(prev)) return prev;
              return keys.length > 0 ? keys[0] : "";
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
  }, [selectedDatasetId]);

  // 데이터셋 변경 시 타입 목록 로드
  useEffect(() => {
    if (!selectedDatasetId) return;

    fetch(`/api/datasets/${selectedDatasetId}/types`)
      .then((r) => r.json())
      .then((data) => {
        setTypeCounts(data.types || []);
        setActiveType("__all__");
      })
      .catch(() => {
        setTypeCounts([]);
        setActiveType("__all__");
      });
  }, [selectedDatasetId]);

  // 표시할 컬럼이 변경되면 columnDefs 업데이트
  useEffect(() => {
    console.log('columnDefs 업데이트 체크:', { 
      visibleColumnsLength: visibleColumns.length, 
      rowDataLength: rowData.length,
      allColumnsLength: allColumns.length 
    });
    
    if (visibleColumns.length === 0) {
      console.log('visibleColumns가 비어있어 columnDefs를 비웁니다.');
      setColumnDefs([]);
      return;
    }

    // rowData가 없어도 컬럼 정의는 생성 (데이터는 나중에 로드될 수 있음)
    const newColumnDefs = visibleColumns.map((k) => {
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
      });
    
    console.log('columnDefs 생성 완료:', { 
      columnDefsCount: newColumnDefs.length,
      firstColumnDef: newColumnDefs[0] 
    });
    setColumnDefs(newColumnDefs);
  }, [visibleColumns, columnMeta]);

  // Score 관련 유틸리티 함수
  const formatScore = (score: any) => {
    const s = typeof score === "number" ? score : Number(score);
    if (!isFinite(s)) return "0.000";
    return s.toFixed(3);
  };

  const scoreLevel = (score: any): "high" | "mid" | "low" => {
    const s = typeof score === "number" ? score : Number(score);
    if (!isFinite(s)) return "low";
    if (s >= 0.55) return "high";
    if (s >= 0.40) return "mid";
    return "low";
  };

  const scoreBadgeStyle = (level: "high" | "mid" | "low") => {
    if (level === "high")
      return { background: "#e6f4ff", border: "1px solid #7db7ff", color: "#0b4aa2" };
    if (level === "mid")
      return { background: "#fff7e6", border: "1px solid #ffc46b", color: "#8a5200" };
    return { background: "#fdecec", border: "1px solid #f19b9b", color: "#8a1f1f" };
  };

  // 컬럼 포커스 함수 (태그 클릭 시 호출)
  const focusColumn = (col: string) => {
    setActiveColumn(col);

    const api = gridApiRef.current;
    const colApi = gridColumnApiRef.current;

    if (!api || !colApi) return;

    // 1) 컬럼이 화면에 보이도록 이동
    try {
      api.ensureColumnVisible(col);
    } catch {
      // field가 아닌 valueGetter 컬럼일 수도 있어서 fallback
      const all = colApi.getAllColumns?.() || [];
      const found = all.find((c: any) => c?.getColId?.() === col);
      if (found) {
        api.ensureColumnVisible(found);
      }
    }

    // 2) 첫 행에 포커스(데이터 없으면 skip)
    if (Array.isArray(rowData) && rowData.length > 0) {
      api.setFocusedCell(0, col);
      api.flashCells({ columns: [col] });
    }
  };

  // activeColumn이 바뀌면 그리드에서 해당 컬럼으로 스크롤
  useEffect(() => {
    if (!gridApiRef.current || !activeColumn) return;
    gridApiRef.current.ensureColumnVisible(activeColumn);
  }, [activeColumn]);

  // 활성 컬럼이 없을 때 'active' 모드 자동 전환
  useEffect(() => {
    if (statsComputeMode === 'active' && !activeColumn) {
      setStatsComputeMode('all');
    }
  }, [activeColumn, statsComputeMode]);

  // 자연어 질의 실행
  const runNaturalLanguageQuery = async () => {
    if (!selectedDatasetId) {
      setNlError("dataset_id가 없습니다. 데이터셋을 먼저 선택하세요.");
      return;
    }
    const q = nlQuestion.trim();
    if (!q) {
      setNlError("질문을 입력하세요.");
      return;
    }

    setNlLoading(true);
    setNlError("");
    setNlResult(null);

    try {
      const res = await fetch(`/api/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataset_id: selectedDatasetId,
          question: q,
          sample_rows: Array.isArray(rowData) ? rowData.slice(0, 50) : [],
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setNlError(data?.detail || "요청 실패");
        setNlLoading(false);
        return;
      }

      setNlResult(data);
      setLastQuestion(q); // 최근 질문 저장

      // ✅ 핵심: columns가 있으면 그걸로 자동 선택
      if (Array.isArray(data.columns) && data.columns.length > 0) {
        setVisibleColumns(data.columns);
      }

      // explain_column인 경우 activeColumn 설정
      if (data.intent === "explain_column" && data.column) {
        setActiveColumn(data.column);
      }

      setNlLoading(false);
    } catch (e: any) {
      setNlError(e?.message || "네트워크 오류");
      setNlLoading(false);
    }
  };

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

  // 요약 텍스트 생성 함수

  const navSummary = (tab: LeftTab) => {
    if (tab === "dataset") {
      const ds = selectedDatasetName || "No dataset";
      const rows = Array.isArray(rowData) ? rowData.length : 0;
      const cols = Array.isArray(allColumns) ? allColumns.length : 0;
      return `${ellipsis(ds, 15)} · ${rows}행 · ${cols}열`;
    }

    if (tab === "stats") {
      // 통계 범위 계산
      let rangeStr = "미설정";
      if (rowRange) {
        rangeStr = `${rowRange.start + 1}~${rowRange.end + 1}`;
      } else if (manualRowStart !== 0 || manualRowEnd !== 0) {
        rangeStr = `${manualRowStart + 1}~${manualRowEnd + 1}`;
      }
      
      // 통계 대상 모드 (간결하게)
      const target = statsComputeMode === "active" ? "활성" : "전체";
      return `${rangeStr} · ${target}`;
    }

    if (tab === "analysis") {
      return lastQuestion ? `최근: ${ellipsis(lastQuestion, 15)}` : "자연어 검색";
    }

    // columns
    const vis = Array.isArray(visibleColumns) ? visibleColumns.length : 0;
    const t = activeType === "__all__" ? "전체" : activeType;
    return `${vis}개 선택 · ${t}`;
  };



  // 컬럼 컨트롤 렌더링 (사용되지 않음 - ColumnsPanel로 이동됨)
  const renderColumnControls = () => {
  return (
      <>
        {/* 선택된 컬럼 태그 표시 */}
        {visibleColumns.length > 0 && (
          <div style={{ marginBottom: 12, padding: 8, backgroundColor: "#f8f9fa", borderRadius: 6, border: "1px solid #e0e0e0" }}>
            <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: 6, color: "#666" }}>
              선택됨: {visibleColumns.length}개
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, maxHeight: 80, overflowY: "auto" }}>
              {visibleColumns.map((col) => (
                <span
                  key={col}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "4px 8px",
                    backgroundColor: activeColumn === col ? "#3498db" : "white",
                    color: activeColumn === col ? "white" : "#333",
                    border: `1px solid ${activeColumn === col ? "#3498db" : "#ddd"}`,
                    borderRadius: 12,
                    fontSize: "11px",
                    cursor: "pointer"
                  }}
                  onClick={() => focusColumn(col)}
                  title="클릭하면 그리드로 이동"
                >
                  {col}
            <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const next = visibleColumns.filter((c) => c !== col);
                      setVisibleColumns(next);
                      if (activeColumn === col) {
                        setActiveColumn(next.length > 0 ? next[0] : "");
                      }
                    }}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: activeColumn === col ? "white" : "#999",
                      cursor: "pointer",
                      padding: 0,
                      marginLeft: 4,
                      fontSize: "12px",
                      lineHeight: 1
                    }}
                    title="제거"
                  >
                    ✕
            </button>
                </span>
              ))}
            </div>
              </div>
            )}
        
        {/* 타입 필터 버튼 */}
        <div style={{ marginBottom: "8px" }}>
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
        <div style={{ marginBottom: "8px" }}>
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
        
        {/* 컬럼 전체 보기 토글 */}
        <div style={{ marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: "12px", color: "#666" }}>
            표시할 컬럼 선택 ({visibleColumns.length}/{allColumns.length})
              </div>
          <div style={{ display: "flex", gap: 4 }}>
                  <button
                    onClick={() => setVisibleColumns(allColumns)}
              style={{
                padding: "4px 8px",
                fontSize: "11px",
                backgroundColor: "#f0f0f0",
                border: "1px solid #ddd",
                borderRadius: "4px",
                cursor: "pointer"
              }}
            >
              모두 선택
                  </button>
                  <button
                    onClick={() => setVisibleColumns([])}
              style={{
                padding: "4px 8px",
                fontSize: "11px",
                backgroundColor: "#f0f0f0",
                border: "1px solid #ddd",
                borderRadius: "4px",
                cursor: "pointer"
              }}
                  >
                    모두 해제
                  </button>
            <button
              onClick={() => setShowAllColumnList(!showAllColumnList)}
              style={{
                padding: "4px 8px",
                fontSize: "11px",
                backgroundColor: showAllColumnList ? "#3498db" : "#f0f0f0",
                color: showAllColumnList ? "white" : "#333",
                border: "1px solid #ddd",
                borderRadius: "4px",
                cursor: "pointer"
              }}
            >
              {showAllColumnList ? "접기" : "전체 보기"}
              </button>
            </div>
          </div>

        {/* 컬럼 리스트 */}
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
                      setActiveColumn(col);
                    }}
                  >
                <input
                      type="checkbox"
                      checked={isChecked}
                  onChange={(e) => {
                        const checked = e.target.checked;
                        if (checked) {
                          if (!visibleColumns.includes(col)) {
                          setVisibleColumns([...visibleColumns, col]);
                          }
                          setActiveColumn(col);
                        } else {
                          const next = visibleColumns.filter((c) => c !== col);
                          setVisibleColumns(next);
                          if (activeColumn === col) {
                            setActiveColumn(next.length > 0 ? next[0] : "");
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
        )}
      </>
    );
  };

  // 좌측 섹션 렌더링 (항상 보이는 핵심 기능들)

  // 중앙 캔버스 렌더링
  const renderCenter = () => {
    if (!selectedDatasetId) {
      return (
        <div className="empty-wrap" style={{ flex: 1, minHeight: 0 }}>
          <div className="empty-card">
            <h2>데이터셋을 선택하세요</h2>
            <p>왼쪽 사이드바에서 데이터셋을 선택하면 데이터가 표시됩니다.</p>
            <div className="examples">
              <span className="chip">🗂 데이터셋 선택</span>
              <span className="chip">🧩 컬럼 선택</span>
              <span className="chip">🧠 자연어 질의</span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <>
        {/* 자연어 질의 결과 표시 */}
        {nlResult && (
          <div style={{ 
            marginBottom: 16, 
            padding: 16, 
            backgroundColor: "#f8f9fa", 
            borderRadius: 8, 
            fontSize: "13px",
            border: "1px solid #e0e0e0"
          }}>
            <div style={{ maxHeight: "400px", overflowY: "auto", paddingRight: 8 }}>
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "space-between",
                gap: 8,
                marginBottom: 12,
                paddingBottom: 8,
                borderBottom: "2px solid #3498db"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ 
                    fontSize: "16px", 
                    fontWeight: 700, 
                    color: "#3498db" 
                  }}>
                    자연어 질의 결과
                  </span>
                  <span style={{ 
                    fontSize: "12px", 
                    color: "#666",
                    backgroundColor: "#e3f2fd",
                    padding: "2px 8px",
                    borderRadius: 12
                  }}>
                    {nlResult.intent}
                  </span>
              </div>
              <button 
                onClick={() => {
                    setNlQuestion("");
                    setNlResult(null);
                    setNlError("");
                  }}
                  style={{
                    padding: "4px 12px",
                    fontSize: "12px",
                    backgroundColor: "#f0f0f0",
                    color: "#333",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    cursor: "pointer"
                  }}
                >
                  닫기
              </button>
            </div>

              {(nlResult.summary || nlResult.summary === "") && (
                <div style={{ 
                  marginTop: 12,
                  padding: 12,
                  backgroundColor: "white",
                  borderRadius: 6,
                  border: "1px solid #e0e0e0"
                }}>
                  <div style={{ 
                    fontSize: "13px", 
                    fontWeight: 600, 
                    marginBottom: 6,
                    color: "#333"
                  }}>
                    📋 요약
                  </div>
                  <div style={{ 
                    fontSize: "13px", 
                    color: "#555",
                    lineHeight: 1.6
                  }}>
                    {nlResult.summary || "요약 정보가 없습니다."}
                  </div>
              </div>
            )}

              {Array.isArray(nlResult.columns) && (
                <div style={{ 
                  marginTop: 12,
                  padding: 12,
                  backgroundColor: "white",
                  borderRadius: 6,
                  border: "1px solid #e0e0e0"
                }}>
                  <div style={{ 
                    fontSize: "13px", 
                    fontWeight: 600, 
                    marginBottom: 6,
                    color: "#333"
                  }}>
                    선택된 컬럼 ({nlResult.columns.length}개)
                  </div>
                  <div style={{ 
                    marginTop: 6,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    maxHeight: 100,
                    overflow: "auto",
                    padding: 6,
                    border: "1px solid #ddd",
                    borderRadius: 6,
                  }}>
                    {nlResult.columns.map((col: string) => (
            <button
                        key={col}
                        onClick={() => focusColumn(col)}
                        style={{
                          padding: "4px 8px",
                          borderRadius: 999,
                          border: activeColumn === col ? "2px solid #333" : "1px solid #bbb",
                          background: activeColumn === col ? "#f2f2f2" : "white",
                          cursor: "pointer",
                          fontSize: 12,
                        }}
                        title="클릭하면 그리드로 이동 + 상세패널 표시"
                      >
                        {col}
            </button>
                ))}
              </div>
              </div>
            )}

              {/* 컬럼 설명 intent인 경우 상세 meta */}
              {nlResult.intent === "explain_column" && nlResult.meta && (
                <div style={{ 
                  marginTop: 12, 
                  padding: 14, 
                  border: "2px solid #4caf50", 
                  borderRadius: 8, 
                  backgroundColor: "#f1f8f4"
                }}>
                  <div style={{ 
                    fontSize: "14px", 
                    fontWeight: 700, 
                    marginBottom: 10,
                    color: "#2e7d32"
                  }}>
                    📖 컬럼 상세 정보
          </div>
                  <div style={{ 
                    display: "grid",
                    gridTemplateColumns: "120px 1fr",
                    gap: "8px 12px",
                    fontSize: "13px"
                  }}>
                    <div style={{ fontWeight: 600, color: "#666" }}>컬럼명:</div>
                    <div style={{ color: "#333" }}>{nlResult.column}</div>
                    <div style={{ fontWeight: 600, color: "#666" }}>타입:</div>
                    <div style={{ color: "#333" }}>{nlResult.meta.type || "없음"}</div>
                    <div style={{ fontWeight: 600, color: "#666" }}>카테고리:</div>
                    <div style={{ color: "#333" }}>{nlResult.meta.category || "없음"}</div>
                    <div style={{ fontWeight: 600, color: "#666" }}>단위:</div>
                    <div style={{ color: "#333" }}>{nlResult.meta.unit || "없음"}</div>
                    <div style={{ fontWeight: 600, color: "#666" }}>설명:</div>
                    <div style={{ color: "#333", lineHeight: 1.6 }}>{nlResult.meta.desc || "설명 없음"}</div>
        </div>
                </div>
              )}

              {/* semantic_search인 경우 hits 근거 표시 */}
              {nlResult.intent === "semantic_search" && Array.isArray(nlResult.hits) && (
                <div style={{ 
                  marginTop: 12, 
                  padding: 14, 
                  border: "1px solid #ddd", 
                  borderRadius: 8,
                  backgroundColor: "white"
                }}>
                  <div style={{ 
                    display: "flex", 
                    justifyContent: "space-between", 
                    alignItems: "center",
                    marginBottom: 10
                  }}>
                    <div style={{ 
                      fontSize: "13px", 
                      fontWeight: 700, 
                      color: "#333"
                    }}>
                      🔍 검색 근거 (hits)
            </div>
                    <div style={{ color: "#666", fontSize: 12 }}>
                      score: 1/(1+distance) (높을수록 관련 높음)
                </div>
                  </div>

                  {/* minScore 필터 */}
                  <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontSize: 12, color: "#666" }}>min score</div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={minScore}
                      onChange={(e) => setMinScore(Number(e.target.value))}
                      style={{ flex: 1 }}
                    />
                    <div style={{ fontSize: 12, width: 60 }}>{minScore.toFixed(2)}</div>
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
                          <th style={{ padding: "6px 6px", width: 50 }}>#</th>
                          <th style={{ padding: "6px 6px" }}>컬럼</th>
                          <th style={{ padding: "6px 6px", width: 110 }}>type</th>
                          <th style={{ padding: "6px 6px", width: 110 }}>score</th>
                          <th style={{ padding: "6px 6px", width: 110 }}>distance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {nlResult.hits
                          .filter((h: any) => (typeof h.score === "number" ? h.score : Number(h.score)) >= minScore)
                          .map((h: any) => {
                            const level = scoreLevel(h.score);
                            const badge = scoreBadgeStyle(level as any);
                            return (
                              <tr key={h.column} style={{ borderBottom: "1px solid #f3f3f3" }}>
                                <td style={{ padding: "8px 6px", color: "#666" }}>{h.rank ?? ""}</td>
                                <td style={{ padding: "8px 6px" }}>
                  <button
                                    onClick={() => focusColumn(h.column)}
                                    style={{
                                      background: "transparent",
                                      border: "none",
                                      padding: 0,
                                      cursor: "pointer",
                                      textDecoration: "underline",
                                      fontWeight: 600,
                                    }}
                                    title="클릭하면 그리드로 이동"
                                  >
                                    {h.column}
                  </button>
                                  {activeColumn === h.column && (
                                    <span style={{ marginLeft: 8, color: "#666", fontSize: 12 }}>
                                      (선택됨)
                                    </span>
                                  )}
                                </td>
                                <td style={{ padding: "8px 6px" }}>{h.type || "unknown"}</td>
                                <td style={{ padding: "8px 6px" }}>
                                  <span
                                    style={{
                                      display: "inline-block",
                                      padding: "2px 8px",
                                      borderRadius: 999,
                                      fontSize: 12,
                                      ...badge,
                                    }}
                                    title={level.toUpperCase()}
                                  >
                                    {formatScore(h.score)}
                                  </span>
                                </td>
                                <td style={{ padding: "8px 6px", color: "#444" }}>
                                  {typeof h.distance === "number" ? h.distance.toFixed(3) : String(h.distance ?? "")}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                </div>
              </div>
              )}

              {/* LLM 답변 */}
              {nlResult.llm_answer && (
                <div style={{
                  marginTop: 12,
                  padding: 12,
                  backgroundColor: "#f0f8ff",
                  borderRadius: 6,
                  border: "1px solid #b3d9ff"
                }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: 6, color: "#0066cc" }}>
                    💬 LLM 답변
              </div>
                  <div style={{ fontSize: "13px", color: "#333", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                    {nlResult.llm_answer}
            </div>
          </div>
              )}
        </div>
                </div>
              )}

        {/* AG Grid */}
        <div style={{ flex: 1, minHeight: 0, width: "100%", display: "flex", flexDirection: "column" }}>
          <div className="ag-theme-alpine" style={{ flex: 1, minHeight: 0, width: "100%" }}>
              <AgGridReact
            ref={gridApiRef}
                columnDefs={columnDefs}
                rowData={rowData}
                defaultColDef={{
                  flex: 1,
                  minWidth: 120,
              resizable: true,
              sortable: true,
            }}
            onGridReady={(params) => {
              console.log('AG Grid 준비 완료:', { 
                columnDefsLength: columnDefs.length, 
                rowDataLength: rowData.length,
                selectedDatasetId 
              });
              gridApiRef.current = params.api;
              gridColumnApiRef.current = params.columnApi;
            }}
            onCellClicked={(e) => {
              if (e?.colDef?.field) {
                setActiveColumn(e.colDef.field);
              } else if (e?.column?.getColId) {
                setActiveColumn(e.column.getColId());
              }
                }}
                onCellMouseDown={onCellMouseDown}
                onCellMouseOver={onCellMouseOver}
            onColumnHeaderClicked={onColumnHeaderClicked}
                getRowStyle={getRowStyle}
            onRangeSelectionChanged={(params) => {
              if (params.finished && params.api) {
                const ranges = params.api.getCellRanges();
                if (ranges && ranges.length > 0) {
                  const range = ranges[0];
                  const startRow = range.startRow?.rowIndex ?? 0;
                  const endRow = range.endRow?.rowIndex ?? 0;
                  setRowRange({ start: startRow, end: endRow });
                } else {
                  setRowRange(null);
                }
              }
            }}
            enableRangeSelection={true}
                suppressRowClickSelection={true}
            animateRows={true}
            rowSelection="multiple"
          />
          </div>
        </div>
      </>
    );
  };

  // 우측 인스펙터 렌더링
  const renderRightInspector = () => {
    return (
      <>
        {/* 컬럼 상세 */}
        <div className="card">
          <h3>컬럼 상세</h3>
          {!activeColumn ? (
            <div style={{ marginTop: 8, color: "var(--muted)" }}>
              컬럼 태그를 클릭하거나 그리드 셀을 클릭하면 상세가 표시됩니다.
            </div>
          ) : (
            (() => {
              const m = columnMeta[activeColumn];
              return (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 14 }}>
                    <b>{activeColumn}</b>
                  </div>
                  <div className="kv" style={{ marginTop: 8 }}>
                    <div className="k">type</div>
                    <div>{m?.type || "unknown"}</div>
                    <div className="k">category</div>
                    <div>{m?.category || ""}</div>
                    <div className="k">unit</div>
                    <div>{m?.unit || ""}</div>
                    <div className="k">desc</div>
                    <div style={{ whiteSpace: "pre-wrap" }}>{m?.desc || ""}</div>
                  </div>
                  {/* semantic_search일 때 hits 근거 중 해당 컬럼만 보여주기 */}
                  {nlResult?.intent === "semantic_search" && Array.isArray(nlResult?.hits) && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #eee" }}>
                      <div style={{ fontWeight: 700 }}>왜 이 컬럼이 나왔나</div>
                      {(() => {
                        const hit = nlResult.hits.find((h: any) => h.column === activeColumn);
                        if (!hit) {
                          return (
                            <div style={{ marginTop: 6, color: "#666" }}>
                              이 컬럼에 대한 hit 정보가 없습니다.
                            </div>
                          );
                        }
                        const level = scoreLevel(hit.score);
                        const badge = scoreBadgeStyle(level as any);
                        return (
                          <div className="kv" style={{ marginTop: 8 }}>
                            <div className="k">rank</div>
                            <div>{hit.rank ?? ""}</div>
                            <div className="k">type</div>
                            <div>{hit.type || "unknown"}</div>
                            <div className="k">category</div>
                            <div>{hit.category || ""}</div>
                            <div className="k">score</div>
                            <div>
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "2px 8px",
                                  borderRadius: 999,
                                  fontSize: 12,
                                  ...badge,
                                }}
                              >
                                {formatScore(hit.score)} ({level})
                              </span>
                            </div>
                            <div className="k">distance</div>
                            <div>{typeof hit.distance === "number" ? hit.distance.toFixed(3) : String(hit.distance ?? "")}</div>
                          </div>
                        );
                      })()}
            </div>
                  )}

                  {/* 메타데이터 출처 안내 */}
                  {m?.auto_generated && (
                    <div style={{
                      marginTop: 12,
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

        {/* 통계 결과 */}
        <div className="card">
          <h3>통계 결과</h3>
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
      </>
    );
  };

  return (
    <div className="app-shell">
      {/* TOPBAR */}
      <div className="topbar">
        <div className="brand">
          <h1>ALDList</h1>
        </div>
        {/* context pills */}
        <div className="context">
          <span className="pill">{selectedDatasetName}</span>
          <span className="pill">Rows {rowData?.length ?? 0}</span>
          <span className="pill">Cols {allColumns?.length ?? 0}</span>
        </div>
      </div>

      {/* MAIN GRID */}
      <div className="main-grid">
        {/* LEFT */}
        <aside className="left">
          <div className="left-nav">
            <LeftNav
              leftTab={leftTab}
              setLeftTab={setLeftTab}
              navSummary={navSummary}
            />
          </div>

          <div className="left-panel">
            <LeftPanel
              leftTab={leftTab}
              datasets={datasets}
              selectedDatasetId={selectedDatasetId}
              setSelectedDatasetId={setSelectedDatasetId}
              setPrevDatasetId={setPrevDatasetId}
              setRowRange={setRowRange}
              setManualRowStart={setManualRowStart}
              setManualRowEnd={setManualRowEnd}
              setStats={setStats}
              setColumnSearchQuery={setColumnSearchQuery}
              setActiveType={setActiveType}
              manualRowStart={manualRowStart}
              manualRowEnd={manualRowEnd}
              rowRange={rowRange}
              statsComputeMode={statsComputeMode}
              setStatsComputeMode={setStatsComputeMode}
              handleCalculateStats={handleCalculateStats}
              isLoadingStats={isLoadingStats}
              nlQuestion={nlQuestion}
              setNlQuestion={setNlQuestion}
              nlLoading={nlLoading}
              runNaturalLanguageQuery={runNaturalLanguageQuery}
              nlError={nlError}
              nlResult={nlResult}
              visibleColumns={visibleColumns}
              setVisibleColumns={setVisibleColumns}
              allColumns={allColumns}
              columnMeta={columnMeta}
              activeColumn={activeColumn}
              setActiveColumn={setActiveColumn}
              activeType={activeType}
              typeCounts={typeCounts}
              columnSearchQuery={columnSearchQuery}
              showAllColumnList={showAllColumnList}
              setShowAllColumnList={setShowAllColumnList}
              focusColumn={focusColumn}
            />
          </div>
        </aside>

        {/* CENTER */}
        <div className="panel">
          <div className="canvas">
            <div className="canvas-top">
              <div className="title">Data Canvas</div>
              <div className="hint">컬럼 선택 또는 자연어 질의를 시작하세요</div>
            </div>
            <div style={{ padding: 12, flex: 1, minHeight: 0, overflow: "auto" }}>
              {renderCenter()}
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="panel">
          <div className="inspector">
            {renderRightInspector()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
