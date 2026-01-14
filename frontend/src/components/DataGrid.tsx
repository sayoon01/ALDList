import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import './DataGrid.css';

interface DataGridProps {
  isLoading: boolean;
  columnDefs: any[];
  rowData: any[];
  rowRange: { start: number; end: number } | null;
  onGridReady: (api: any) => void;
  onCellMouseDown: (params: any) => void;
  onCellMouseOver: (params: any) => void;
  onColumnHeaderClicked: (params: any) => void;
  getRowStyle: (params: any) => any;
}

function DataGrid({
  isLoading,
  columnDefs,
  rowData,
  rowRange,
  onGridReady,
  onCellMouseDown,
  onCellMouseOver,
  onColumnHeaderClicked,
  getRowStyle,
}: DataGridProps) {
  return (
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
            onGridReady={(params) => onGridReady(params.api)}
            onCellMouseDown={onCellMouseDown}
            onCellMouseOver={onCellMouseOver}
            onColumnHeaderClicked={onColumnHeaderClicked}
            getRowStyle={getRowStyle}
            rowSelection="multiple"
            animateRows={true}
            suppressRowClickSelection={true}
            tooltipShowDelay={500}
            tooltipHideDelay={1000}
            enableBrowserTooltips={true}
          />
        </div>
      )}
    </div>
  );
}

export default DataGrid;
