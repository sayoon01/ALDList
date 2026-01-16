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
          isLoadingStats={c.isLoadingStats}
          onCalculateStats={() => {
            c.handleCalculateStats().catch((e) => {
              console.error(e);
              showError(e.message || "통계 계산 중 오류가 발생했습니다.");
            });
          }}
          showSelectedOnly={showSelectedOnly}
          onShowSelectedOnlyChange={setShowSelectedOnly}
          profileText={c.profileText}
          docText={c.docText}
          adminBusy={c.adminBusy}
          onBuildProfile={() => {
            c.handleBuildProfile().catch((e) => {
              console.error(e);
              showError(e.message || "Profile 빌드 중 오류가 발생했습니다.");
            });
          }}
          onBuildDoc={() => {
            c.handleBuildDoc().catch((e) => {
              console.error(e);
              showError(e.message || "Doc 빌드 중 오류가 발생했습니다.");
            });
          }}
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
          profileText={c.profileText}
          docText={c.docText}
        />
      </div>
    </div>
  );
}
