import { LeftTab } from '../types';
import { DatasetPanel } from './panels/DatasetPanel';
import { StatsPanel } from './panels/StatsPanel';
import { AnalysisPanel } from './panels/AnalysisPanel';
import { ColumnsPanel } from './panels/ColumnsPanel';

interface LeftPanelProps {
  leftTab: LeftTab;
  // DatasetPanel props
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
  // StatsPanel props
  manualRowStart: number;
  manualRowEnd: number;
  rowRange: { start: number; end: number } | null;
  statsComputeMode: 'all' | 'active';
  setStatsComputeMode: (mode: 'all' | 'active') => void;
  handleCalculateStats: () => void;
  isLoadingStats: boolean;
  // AnalysisPanel props
  nlQuestion: string;
  setNlQuestion: (q: string) => void;
  nlLoading: boolean;
  runNaturalLanguageQuery: () => void;
  nlError: string;
  nlResult: any;
  // ColumnsPanel props
  visibleColumns: string[];
  setVisibleColumns: (cols: string[]) => void;
  allColumns: string[];
  columnMeta: Record<string, any>;
  activeColumn: string;
  setActiveColumn: (col: string) => void;
  activeType: string;
  typeCounts: Array<{type: string; count: number}>;
  columnSearchQuery: string;
  showAllColumnList: boolean;
  setShowAllColumnList: (show: boolean) => void;
  focusColumn: (col: string) => void;
}

export const LeftPanel = ({ leftTab, ...props }: LeftPanelProps) => {
  switch (leftTab) {
    case "dataset":
      return <DatasetPanel {...props} setVisibleColumns={props.setVisibleColumns} allColumns={props.allColumns} />;
    case "stats":
      return <StatsPanel {...props} />;
    case "analysis":
      return <AnalysisPanel {...props} />;
    case "columns":
    default:
      return <ColumnsPanel {...props} />;
  }
};
