import { useEffect, useMemo, useState } from "react";
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

  // ===== Actions =====

  // ========= 액션 1) bootstrap =========
  const bootstrap = async () => {
    // datasets + meta types 로드 (앱 시작 1회)
    try {
      const [dsRes, typesRes] = await Promise.all([
        getDatasets(),
        getMetaTypes(), // 단일 진실
      ]);

      setDatasets(dsRes.datasets || []);
      if ((dsRes.datasets || []).length > 0) {
        setSelectedDatasetId(dsRes.datasets[0].dataset_id);
      }

      const types = typesRes.types || [];
      setMetaTypes(types);
      setOrderedTypes(typesRes.order || types);
      setTypeLabels(typesRes.labels || {});
      setAllowedTypes(types); // 선택: sidebarTypes 계산에 쓰고 싶으면 저장
    } catch (e) {
      console.error("bootstrap 실패:", e);
    }
  };

  // ========= 액션 2) selectDataset =========
  const selectDataset = (datasetId: string) => {
    // "선택"은 state만 바꾸고, 실제 로드는 effect에서 통일
    setSelectedDatasetId(datasetId);

    // UI 상태 초기화 (너 코드랑 동일)
    setOffset(0);
    setRowRange(null);
    setManualRowStart(0);
    setManualRowEnd(0);
    setStats(null);
    setColumnSearchQuery("");
    setSelectedTypeFilter(null);

    // profile/doc는 effect에서 자동 로드됨
  };

  // ========= 액션 3) loadPreviewAndColumns (내부) =========
  const loadPreviewAndColumns = async (datasetId: string, nextOffset: number, nextLimit: number) => {
    setIsLoading(true);
    try {
      const preview = await getPreview(datasetId, nextOffset, nextLimit);

      const keys = preview.columns || (preview.rows?.[0] ? Object.keys(preview.rows[0]) : []);
      setAllColumns(keys);
      setRowData(preview.rows || []);

      // visibleColumns / activeColumn 초기화 정책 (너 코드 정책 유지)
      if (keys.length > 0) {
        // visibleColumns이 비었거나 dataset이 바뀌었으면 첫 컬럼만
        setVisibleColumns((prev) => (prev?.length ? prev : [keys[0]]));
        setActiveColumn((prev) => prev ?? keys[0]);
      } else {
        setVisibleColumns([]);
        setActiveColumn(null);
      }

      // columns/meta
      const cols = await fetchDatasetColumns(datasetId);
      setColumnMeta(cols.meta || {});
      setSelectedTypeFilter(null);
    } catch (e) {
      console.error("preview/columns 로딩 실패:", e);
      setRowData([]);
      setAllColumns([]);
      setVisibleColumns([]);
      setColumnMeta({});
      setActiveColumn(null);
    } finally {
      setIsLoading(false);
    }
  };

  // ========= 액션 4) updatePreviewRange =========
  // ✅ 여기서는 "setOffset/setLimit 호출하라는 뜻 아님"
  // 다만 "range 변경"이라는 개념을 이름으로 고정해두는 용도
  const updatePreviewRange = (nextOffset: number, nextLimit: number) => {
    setOffset(nextOffset);
    setLimit(nextLimit);
  };

  // ========= Effects =========
  // 1) bootstrap (1회)
  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) dataset/offset/limit 변경 시 preview+meta 로드
  useEffect(() => {
    if (!selectedDatasetId) return;
    loadPreviewAndColumns(selectedDatasetId, offset, limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDatasetId, offset, limit]);

  // 3) dataset 변경 시 profile/doc 있으면 로드(실패 무시)
  useEffect(() => {
    if (!selectedDatasetId) {
      setProfile(null);
      setDocMd("");
      return;
    }
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
    // 1) UI 상태 먼저 반영
    setSelectedTypeFilter(type);

    // "전체"면: 타입 필터 해제 + visibleColumns는 비우거나(기존 정책) 전체로 돌리거나 선택
    if (type === null) {
      // 너 기존 정책이 "전체 누르면 visibleColumns 비우기"였음. 그거 그대로면 아래:
      setVisibleColumns([]);
      return;
    }

    // dataset 없으면 종료
    if (!selectedDatasetId) return;

    // 2) 서버에 type별 컬럼 요청 (성공하면 그 결과로 visibleColumns 갱신)
    try {
      const res = await getFieldsByType(selectedDatasetId, type);
      const cols = res.columns || [];
      setVisibleColumns(cols);

      // activeColumn도 자연스럽게 첫 컬럼으로 맞춰주기(원하면)
      setActiveColumn((prev) => {
        if (prev && cols.includes(prev)) return prev;
        return cols.length ? cols[0] : null;
      });
      return;
    } catch (e) {
      // 3) 실패하면 로컬 fallback: columnMeta.type 기준 필터링
      const filtered = allColumns.filter((c) => columnMeta[c]?.type === type);
      setVisibleColumns(filtered);
      setActiveColumn((prev) => {
        if (prev && filtered.includes(prev)) return prev;
        return filtered.length ? filtered[0] : null;
      });
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
        setSelectedDatasetId((res.datasets || [])[0]?.dataset_id || "");
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
