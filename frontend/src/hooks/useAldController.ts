import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  getDatasets,
  getPreview,
  getStats,
  fetchDatasetColumns,
  buildProfile,
  buildDoc,
  readProfile,
  readDoc,
  getMetaTypes,
  getFieldsByType,
  adminRefresh,
  Dataset,
  StatsResponse,
  ColumnMeta,
} from "../api";

export function useAldController() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("");
  const [prevDatasetId, setPrevDatasetId] = useState<string>("");
  const selectedDatasetIdRef = useRef<string>("");

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
  const [limit, setLimit] = useState(300);

  const [rowRange, setRowRange] = useState<{ start: number; end: number } | null>(null);
  const [manualRowStart, setManualRowStart] = useState<number>(0);
  const [manualRowEnd, setManualRowEnd] = useState<number>(0);

  const [isLoading, setIsLoading] = useState(false);

  // 통계 계산 모드
  const [statsComputeMode, setStatsComputeMode] = useState<"all" | "active">("all");

  // 컬럼 검색/타입 필터
  const [columnSearchQuery, setColumnSearchQuery] = useState<string>("");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string | null>(null);
  const [metaTypes, setMetaTypes] = useState<string[]>([]);
  const [typeLabels, setTypeLabels] = useState<Record<string, string>>({});
  const [orderedTypes, setOrderedTypes] = useState<string[]>([]);
  const [allowedTypes, setAllowedTypes] = useState<string[]>([]); // 선택: sidebarTypes 계산에 쓰고 싶으면 저장

  // 선택한 컬럼만 보기 토글
  const [showSelectedOnly, setShowSelectedOnly] = useState<boolean>(false);

  // Profile/Doc 상태 (중앙 관리)
  const [profile, setProfile] = useState<any | null>(null);
  const [docMd, setDocMd] = useState<string>("");
  const [adminBusy, setAdminBusy] = useState(false);

  // ========= derived =========
  // Sidebar에서 쓸 "표시할 타입 목록"은 allowedTypes 우선, 없으면 metaTypes/order fallback
  const sidebarTypes = useMemo(() => {
    if (allowedTypes?.length) return allowedTypes;
    if (orderedTypes?.length) return orderedTypes;
    return metaTypes || [];
  }, [allowedTypes, orderedTypes, metaTypes]);

  // =========================
  // 1) 로더 함수들 (분리)
  // =========================

  const loadPreview = useCallback(
    async (datasetId: string, nextOffset: number, nextLimit: number) => {
      const previewData = await getPreview(datasetId, nextOffset, nextLimit);
      const data = previewData;

      if (data.rows && data.rows.length > 0) {
        const keys = data.columns || Object.keys(data.rows[0]);
        setAllColumns(keys);

        // dataset 변경이거나 visibleColumns 비었을 때만 초기화
        setVisibleColumns((prevVisible) => {
          const isDatasetChanged = prevDatasetId !== datasetId;
          if (isDatasetChanged || prevVisible.length === 0) {
            return keys.length > 0 ? [keys[0]] : [];
          }

          // 기존 visibleColumns 유지하되, 새 키 생기면 반영
          const newColumns = keys.filter((k) => !prevVisible.includes(k));
          const updatedColumns = prevVisible.filter((k) => keys.includes(k));
          return [...updatedColumns, ...newColumns];
        });

        setActiveColumn((prev) => {
          const isDatasetChanged = prevDatasetId !== datasetId;
          if (isDatasetChanged) return keys.length > 0 ? keys[0] : null;
          if (!prev) return keys.length > 0 ? keys[0] : null;
          if (keys.includes(prev)) return prev;
          return keys.length > 0 ? keys[0] : null;
        });

        setRowData(data.rows);
      } else {
        setAllColumns([]);
        setVisibleColumns([]);
        setRowData([]);
        setActiveColumn(null);
      }
    },
    [prevDatasetId]
  );

  const loadColumnsMeta = useCallback(async (datasetId: string) => {
    const columnsData = await fetchDatasetColumns(datasetId);
    setColumnMeta(columnsData.meta || {});
    setSelectedTypeFilter(null);
  }, []);

  // =========================
  // 2) 액션 3개 (핵심)
  // =========================

  const bootstrap = useCallback(async () => {
    try {
      // datasets
      const dsRes = await getDatasets();
      setDatasets(dsRes.datasets || []);

      // meta/types
      try {
        const t = await getMetaTypes();
        const types = t.types || [];
        setMetaTypes(types);
        setOrderedTypes(t.order || types);
        setTypeLabels(t.labels || {});
        setAllowedTypes(types);
      } catch (e) {
        console.warn("meta/types 로드 실패:", e);
        setMetaTypes([]);
        setOrderedTypes([]);
        setTypeLabels({});
        setAllowedTypes([]);
      }

      // 첫 데이터셋 자동 선택 (useEffect가 selectDataset 호출)
      if ((dsRes.datasets || []).length > 0) {
        const firstId = dsRes.datasets[0].dataset_id;
        selectedDatasetIdRef.current = firstId;
        setSelectedDatasetId(firstId);
      }
    } catch (e) {
      console.error("bootstrap 실패:", e);
      setDatasets([]);
      setMetaTypes([]);
      setOrderedTypes([]);
      setTypeLabels({});
      setAllowedTypes([]);
    }
  }, []);

  const selectDataset = useCallback(
    async (datasetId: string) => {
      // dataset 전환 시 필요한 상태 초기화(필수만)
      setIsLoading(true);
      try {
        // 현재 selectedDatasetId를 prevDatasetId로 저장 (ref 사용)
        setPrevDatasetId(selectedDatasetIdRef.current);
        selectedDatasetIdRef.current = datasetId;
        setSelectedDatasetId(datasetId);

        // 선택 관련 초기화
        setOffset(0);
        setRowRange(null);
        setManualRowStart(0);
        setManualRowEnd(0);
        setStats(null);
        setColumnSearchQuery("");
        setSelectedTypeFilter(null);

        // Profile/Doc은 "있으면 자동 로드" 유지 (조용히 실패)
        (async () => {
          try {
            const p = await readProfile(datasetId);
            setProfile(p);
          } catch {
            setProfile(null);
          }
          try {
            const md = await readDoc(datasetId);
            setDocMd(md);
          } catch {
            setDocMd("");
          }
        })();

        // preview -> columns/meta 순서 (기본 limit 300 사용)
        await loadPreview(datasetId, 0, 300);
        await loadColumnsMeta(datasetId);
      } finally {
        setIsLoading(false);
      }
    },
    [loadPreview, loadColumnsMeta]
  );

  const updatePreviewRange = useCallback(
    async (nextOffset: number, nextLimit: number) => {
      // 내부에서 setOffset/setLimit 호출하여 단일 진입점으로 만듦
      setOffset(nextOffset);
      setLimit(nextLimit);

      if (!selectedDatasetId) return;

      setIsLoading(true);
      try {
        await loadPreview(selectedDatasetId, nextOffset, nextLimit);
        // columns/meta는 여기서 다시 안 불러도 됨
      } finally {
        setIsLoading(false);
      }
    },
    [selectedDatasetId, loadPreview]
  );

  // =========================
  // 3) useEffect는 "액션 호출만"
  // =========================

  // 앱 시작 1회
  useEffect(() => {
    bootstrap().catch((e) => console.error("bootstrap 실패:", e));
  }, [bootstrap]);

  // datasetId 바뀌면 selectDataset 실행
  useEffect(() => {
    if (!selectedDatasetId) return;
    selectDataset(selectedDatasetId).catch((e) => {
      console.error("selectDataset 실패:", e);
      console.error("에러 상세:", e.message);
    });
  }, [selectedDatasetId, selectDataset]);

  // offset/limit 변경은 updatePreviewRange를 통해서만 하게 하는 게 이상적이라
  // 아래 useEffect는 "안전망" 정도로만 둠 (원하면 삭제 가능)
  useEffect(() => {
    // offset/limit이 직접 set된 경우에도 preview는 맞춰주기
    if (!selectedDatasetId) return;
    loadPreview(selectedDatasetId, offset, limit).catch((e) => {
      console.error("loadPreview 실패:", e);
      console.error("에러 상세:", e.message);
    });
  }, [selectedDatasetId, offset, limit, loadPreview]);

  // 4) visibleColumns -> columnDefs 생성 (너 로직 유지)
  useEffect(() => {
    if (visibleColumns.length === 0) {
      setColumnDefs([]);
      return;
    }

    setColumnDefs(
      visibleColumns.map((k) => {
        const hasSpecialChars = /[.()]/.test(k);
        const m = columnMeta[k];

        const headerTooltip = m?.desc
          ? `${m.desc}${m.unit ? ` (${m.unit})` : ""}${m.auto_generated ? " [auto]" : ""}`
          : k;

        const colDef: any = {
          headerName: k,
          filter: true,
          sortable: true,
          resizable: true,
          headerTooltip: headerTooltip
            ? `${headerTooltip}\n\n💡 클릭하면 상세 정보를 확인할 수 있습니다.`
            : `💡 클릭하면 상세 정보를 확인할 수 있습니다.`,
          tooltipValueGetter: (params: any) => (params.value != null ? String(params.value) : null),
          minWidth: 120,
          valueFormatter: (params: any) => {
            if (params.value == null || params.value === "") return "—";
            return String(params.value);
          },
          headerClass: "clickable-header",
        };

        if (hasSpecialChars) {
          colDef.valueGetter = (params: any) => (params.data ? params.data[k] : null);
        } else {
          colDef.field = k;
        }

        return colDef;
      })
    );
  }, [visibleColumns, columnMeta]);

  // 5) activeColumn -> ensure visible
  useEffect(() => {
    if (!gridApi || !activeColumn) return;
    gridApi.ensureColumnVisible(activeColumn);
  }, [gridApi, activeColumn]);

  // 6) active 모드인데 activeColumn 없으면 all로
  useEffect(() => {
    if (statsComputeMode === "active" && !activeColumn) {
      setStatsComputeMode("all");
    }
  }, [activeColumn, statsComputeMode]);


  // ========= 액션 5) computeStats =========
  const computeStats = async () => {
    if (!selectedDatasetId) throw new Error("dataset이 선택되지 않았습니다.");
    if (visibleColumns.length === 0) throw new Error("통계 계산을 하려면 최소 컬럼 1개 선택 필요");

    let rowStart: number;
    let rowEnd: number;

    if (manualRowStart !== 0 || manualRowEnd !== 0) {
      rowStart = manualRowStart;
      rowEnd = manualRowEnd + 1;
    } else if (rowRange) {
      rowStart = rowRange.start;
      rowEnd = rowRange.end + 1;
    } else {
      throw new Error("통계 계산할 범위를 선택하거나 입력해주세요.");
    }

    setIsLoadingStats(true);
    try {
      let computeColumns: string[] | undefined;
      if (statsComputeMode === "active" && activeColumn && visibleColumns.includes(activeColumn)) {
        computeColumns = [activeColumn];
      }
      const result = await getStats(selectedDatasetId, visibleColumns, rowStart, rowEnd, computeColumns);
      setStats(result);
      return result;
    } finally {
      setIsLoadingStats(false);
    }
  };

  // ========= drag selection (너 기존 유지) =========
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
      if (isSelecting) setIsSelecting(false);
    };
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, [isSelecting]);

  useEffect(() => {
    if (rowRange && !isSelecting) {
      setManualRowStart(rowRange.start);
      setManualRowEnd(rowRange.end);
    }
  }, [rowRange, isSelecting]);

  // header click -> activeColumn + Sidebar scroll (너 기존 유지)
  const onColumnHeaderClicked = (params: any) => {
    if (params.column && params.column.getColId()) {
      const columnId = params.column.getColId();
      if (allColumns.includes(columnId)) {
        setActiveColumn(columnId);

        const element = document.querySelector(`[data-column="${columnId}"]`);
        if (element) element.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  };

  // 데이터셋 변경 (selectDataset 호출)
  const handleDatasetChange = (datasetId: string) => {
    selectDataset(datasetId);
  };

  // ========= 타입 선택 핸들러 =========
  const handleTypeSelect = async (type: string | null) => {
    setSelectedTypeFilter(type);

    // 전체: 필터 해제 → 전체 컬럼 보여주기
    if (type === null) {
      setVisibleColumns(allColumns);
      setActiveColumn(allColumns[0] ?? null);
      return;
    }

    // 타입 선택: 서버 fields 우선, 실패하면 로컬 fallback
    try {
      if (!selectedDatasetId) throw new Error("dataset not selected");
      const res = await getFieldsByType(selectedDatasetId, type);
      setVisibleColumns(res.columns);
      setActiveColumn(res.columns[0] ?? null);
    } catch {
      const filtered = allColumns.filter((c) => columnMeta[c]?.type === type);
      setVisibleColumns(filtered);
      setActiveColumn(filtered[0] ?? null);
    }
  };

  // Profile/Doc 빌드 핸들러 (기존 호환성 유지)
  const handleBuildProfile = async () => {
    if (!selectedDatasetId) return;
    try {
      setAdminBusy(true);
      await buildAndLoadProfile(selectedDatasetId);
    } finally {
      setAdminBusy(false);
    }
  };

  const handleBuildDoc = async () => {
    if (!selectedDatasetId) return;
    try {
      setAdminBusy(true);
      await buildAndLoadDoc(selectedDatasetId);
    } finally {
      setAdminBusy(false);
    }
  };

  // ========= Admin 액션 =========
  const buildAndLoadProfile = async (datasetId: string) => {
    await buildProfile(datasetId);
    const p = await readProfile(datasetId);
    setProfile(p);
    return p;
  };

  const buildAndLoadDoc = async (datasetId: string) => {
    await buildDoc(datasetId);
    const md = await readDoc(datasetId);
    setDocMd(md);
    return md;
  };

  const refreshAll = async (force: boolean = false) => {
    try {
      setAdminBusy(true);
      await adminRefresh(force);

      // datasets 재조회 + 선택 유지 체크
      const res = await getDatasets();
      setDatasets(res.datasets || []);

      const stillExists = (res.datasets || []).some((ds) => ds.dataset_id === selectedDatasetId);
      if (!stillExists) {
        const newId = (res.datasets || [])[0]?.dataset_id || "";
        selectedDatasetIdRef.current = newId;
        setSelectedDatasetId(newId);
      }

      // meta/types 재로드
      try {
        const typesRes = await getMetaTypes();
        const types = typesRes.types || [];
        setMetaTypes(types);
        setOrderedTypes(typesRes.order || types);
        setTypeLabels(typesRes.labels || {});
        setAllowedTypes(types);
      } catch (e) {
        console.warn("meta/types 재로드 실패:", e);
      }

      return res;
    } finally {
      setAdminBusy(false);
    }
  };

  return {
    datasets,
    selectedDatasetId,
    allColumns,
    visibleColumns,
    columnDefs,
    rowData,
    columnMeta,
    activeColumn,
    stats,
    isLoadingStats,
    offset,
    limit,
    rowRange,
    manualRowStart,
    manualRowEnd,
    isLoading,
    statsComputeMode,
    columnSearchQuery,
    selectedTypeFilter,
    sidebarTypes,
    metaTypes,
    orderedTypes,
    typeLabels,
    allowedTypes,
    adminBusy,
    profile,
    docMd,

    // setters (필요한 것만)
    setGridApi,
    setOffset,
    setLimit,
    setVisibleColumns,
    setActiveColumn,
    setManualRowStart,
    setManualRowEnd,
    setStatsComputeMode,
    setColumnSearchQuery,
    setSelectedTypeFilter,

    // 핵심 액션
    selectDataset,
    updatePreviewRange,
    computeStats,

    // 타입 선택 핸들러
    handleTypeSelect,

    // admin
    refreshAll,
    buildAndLoadProfile,
    buildAndLoadDoc,

    // grid handlers
    onCellMouseDown,
    onCellMouseOver,
    onColumnHeaderClicked,

    // 하위 호환성 (기존 코드 호환)
    handleDatasetChange,
    handleSelectType: handleTypeSelect,
    handleCalculateStats: computeStats,
    handleBuildProfile,
    handleBuildDoc,
    handleRefresh: refreshAll,
    showSelectedOnly,
    setShowSelectedOnly,
  };
}
