// 패널 컴포넌트들의 공통 props 타입 정의

export interface DatasetPanelProps {
  datasets: any[];
  selectedDatasetId: string;
  setSelectedDatasetId: (id: string) => void;
  setPrevDatasetId: (id: string) => void;
  setRowRange: (range: { start: number; end: number } | null) => void;
  setManualRowStart: (start: number) => void;
  setManualRowEnd: (end: number) => void;
  setStats: (stats: any) => void;
  setColumnSearchQuery: (query: string) => void;
  setActiveType: (type: string) => void;
}

export interface StatsPanelProps {
  manualRowStart: number;
  manualRowEnd: number;
  setManualRowStart: (start: number) => void;
  setManualRowEnd: (end: number) => void;
  rowRange: { start: number; end: number } | null;
  statsComputeMode: 'all' | 'active';
  setStatsComputeMode: (mode: 'all' | 'active') => void;
  handleCalculateStats: () => void;
  isLoadingStats: boolean;
}

export interface AnalysisPanelProps {
  nlQuestion: string;
  setNlQuestion: (q: string) => void;
  nlLoading: boolean;
  runNaturalLanguageQuery: () => void;
  nlError: string;
  nlResult: any;
  selectedDatasetId: string;
}

export interface ColumnsPanelProps {
  visibleColumns: string[];
  setVisibleColumns: (cols: string[]) => void;
  allColumns: string[];
  columnMeta: Record<string, any>;
  activeColumn: string;
  setActiveColumn: (col: string) => void;
  activeType: string;
  setActiveType: (type: string) => void;
  typeCounts: Array<{type: string; count: number}>;
  columnSearchQuery: string;
  setColumnSearchQuery: (query: string) => void;
  showAllColumnList: boolean;
  setShowAllColumnList: (show: boolean) => void;
  focusColumn: (col: string) => void;
}
