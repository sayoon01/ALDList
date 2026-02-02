import { useEffect, useState } from "react";
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
  const [limit, setLimit] = useState(500);

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

  // 선택한 컬럼만 보기 토글
  const [showSelectedOnly, setShowSelectedOnly] = useState<boolean>(false);

  // Profile/Doc 상태 (중앙 관리)
  const [profile, setProfile] = useState<any | null>(null);
  const [docMd, setDocMd] = useState<string>("");
  const [adminBusy, setAdminBusy] = useState(false);

  // 1) 데이터셋 목록 로드
  useEffect(() => {
    getDatasets()
      .then((res) => {
        setDatasets(res.datasets);
        if (res.datasets.length > 0) {
          setSelectedDatasetId(res.datasets[0].dataset_id);
        }
      })
      .catch((error) => {
        console.error("데이터셋 목록 로드 실패:", error);
      });
  }, []);

  // 1-1) 메타 타입 목록 로드 (카탈로그: types, labels, order)
  useEffect(() => {
    (async () => {
      try {
        const res = await getMetaTypes();
        setMetaTypes(res.types || []);
        setOrderedTypes(res.order || res.types || []);
        setTypeLabels(res.labels || {});
      } catch (e) {
        console.warn("meta/types 로드 실패", e);
        setMetaTypes([]);
        setOrderedTypes([]);
        setTypeLabels({});
      }
    })();
  }, []);

  // 2) 선택된 데이터셋 columns/meta 로드 (datasetId만 의존)
  useEffect(() => {
    if (!selectedDatasetId) return;

    let cancelled = false;

    (async () => {
      try {
        const columnsData = await fetchDatasetColumns(selectedDatasetId);
        if (cancelled) return;

        setColumnMeta(columnsData.meta || {});
        setSelectedTypeFilter(null);
      } catch (e) {
        if (cancelled) return;
        console.error("컬럼 메타 로드 실패:", e);
        setColumnMeta({});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedDatasetId]);

  // 3) 선택된 데이터셋 preview 로드 (datasetId, offset, limit에만 반응)
  useEffect(() => {
    if (!selectedDatasetId) return;

    let cancelled = false;
    setIsLoading(true);

    getPreview(selectedDatasetId, offset, limit)
      .then((previewData) => {
        if (cancelled) return;

        const data = previewData;

        if (data.rows && data.rows.length > 0) {
          const keys = data.columns || Object.keys(data.rows[0]);
          setAllColumns(keys);
          setRowData(data.rows);

          // ✅ 여기서 visibleColumns/activeColumn은 "비어있을 때만" 세팅
          // (dataset 변경 시 초기화는 handleDatasetChange에서 이미 처리)
          setVisibleColumns((prev) => {
            if (prev.length > 0) return prev;
            return keys.length > 0 ? [keys[0]] : [];
          });

          setActiveColumn((prev) => {
            if (prev) return prev;
            return keys.length > 0 ? keys[0] : null;
          });
        } else {
          setAllColumns([]);
          setRowData([]);
          setVisibleColumns([]);
          setActiveColumn(null);
        }
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("preview 로딩 실패:", error);
        setRowData([]);
        setAllColumns([]);
        setVisibleColumns([]);
        setActiveColumn(null);
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDatasetId, offset, limit]);

  // 4) visibleColumns 바뀌면 columnDefs 업데이트
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

  // 5) activeColumn 바뀌면 그리드에서 해당 컬럼으로 스크롤
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

  // 7) dataset 선택될 때, profile/doc "있으면 자동 로드"
  useEffect(() => {
    if (!selectedDatasetId) {
      setProfile(null);
      setDocMd("");
      return;
    }

    // profile/doc는 "없을 수도 있음" -> 실패해도 조용히 무시
    (async () => {
      try {
        const p = await readProfile(selectedDatasetId);
        setProfile(p);
      } catch {
        setProfile(null);
      }

      try {
        const md = await readDoc(selectedDatasetId);
        setDocMd(md);
      } catch {
        setDocMd("");
      }
    })();
  }, [selectedDatasetId]);

  // 통계 계산
  const handleCalculateStats = async () => {
    if (!selectedDatasetId) return;

    if (visibleColumns.length === 0) {
      throw new Error("통계 계산을 하려면 최소한 컬럼 1개를 선택해주세요.");
    }

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
    } catch (error: any) {
      throw error; // App.tsx에서 처리하도록 재throw
    } finally {
      setIsLoadingStats(false);
    }
  };

  // 드래그 선택 상태
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

  // 그리드 헤더 클릭 -> activeColumn 설정 + Sidebar 스크롤
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

  // 데이터셋 변경 시 초기화
  const handleDatasetChange = (datasetId: string) => {
    setSelectedDatasetId(datasetId);

    // ✅ dataset 변경 시 UI 상태 초기화는 여기서만
    setOffset(0);
    setRowRange(null);
    setManualRowStart(0);
    setManualRowEnd(0);
    setStats(null);

    setColumnSearchQuery("");
    setSelectedTypeFilter(null);

    // ✅ 컬럼 선택 초기화 (preview 로드 후 keys 기준으로 "비어있을 때만" 채워짐)
    setVisibleColumns([]);
    setActiveColumn(null);

    // Profile/Doc은 아래 useEffect(#7)에서 자동 read
  };

  // 타입 선택 핸들러
  const handleSelectType = async (type: string | null) => {
    setSelectedTypeFilter(type);

    // 전체 선택이면: visibleColumns 비우고 사용자가 다시 고르게 한다
    if (type === null) {
      setVisibleColumns([]);
      return;
    }

    if (!selectedDatasetId) return;

    try {
      const result = await getFieldsByType(selectedDatasetId, type);
      setVisibleColumns(result.columns || []);
      setActiveColumn((prev) => {
        const next = (result.columns || [])[0] ?? null;
        return next ?? prev ?? null;
      });
    } catch (e) {
      // fallback: 로컬 meta로 필터링
      const filtered = allColumns.filter((c) => columnMeta[c]?.type === type);
      setVisibleColumns(filtered);
      setActiveColumn((prev) => filtered[0] ?? prev ?? null);
    }
  };

  // Profile/Doc 빌드 및 로드 핸들러
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

  // Refresh 후 UI 상태 리셋
  const handleRefresh = async (force: boolean = false) => {
    try {
      setAdminBusy(true);
      
      // 1) 백엔드 refresh 실행
      await adminRefresh(force);
      
      // 2) 데이터셋 목록 재조회
      const res = await getDatasets();
      const prevSelectedId = selectedDatasetId;
      
      // 3) 선택된 데이터셋이 삭제되었는지 확인
      const stillExists = res.datasets.some(ds => ds.dataset_id === prevSelectedId);
      
      setDatasets(res.datasets);
      
      // 4) 삭제되었거나 목록이 비어있으면 첫 번째로 변경
      if (!stillExists || res.datasets.length === 0) {
        if (res.datasets.length > 0) {
          setSelectedDatasetId(res.datasets[0].dataset_id);
        } else {
          setSelectedDatasetId("");
        }
      }
      
      // 5) 메타 타입 목록도 다시 로드
      try {
        const metaTypesRes = await getMetaTypes();
        setMetaTypes(metaTypesRes.types || []);
        // order가 있으면 order 우선, 없으면 types 순서 사용
        setOrderedTypes(metaTypesRes.order || metaTypesRes.types || []);
        setTypeLabels(metaTypesRes.labels || {});
      } catch (error) {
        console.warn("메타 타입 목록 재로드 실패:", error);
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
    metaTypes,
    orderedTypes,
    typeLabels,
    showSelectedOnly,
    profile,
    docMd,
    adminBusy,

    // setters
    setOffset,
    setLimit,
    setManualRowStart,
    setManualRowEnd,
    setVisibleColumns,
    setActiveColumn,
    setGridApi,
    setStatsComputeMode,
    setColumnSearchQuery,
    setSelectedTypeFilter,
    setShowSelectedOnly,

    // handlers
    handleDatasetChange,
    handleSelectType,
    handleCalculateStats,
    handleBuildProfile,
    handleBuildDoc,
    handleRefresh,
    buildAndLoadProfile,
    buildAndLoadDoc,
    onCellMouseDown,
    onCellMouseOver,
    onColumnHeaderClicked,
  };
}
