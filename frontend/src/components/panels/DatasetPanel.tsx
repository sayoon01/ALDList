import { DatasetPanelProps } from './types';

export const DatasetPanel = ({
  datasets,
  selectedDatasetId,
  setSelectedDatasetId,
  setPrevDatasetId,
  setRowRange,
  setManualRowStart,
  setManualRowEnd,
  setStats,
  setColumnSearchQuery,
  setActiveType,
  setVisibleColumns,
  allColumns,
}: DatasetPanelProps & { setVisibleColumns: (cols: string[]) => void; allColumns: string[] }) => {
  return (
    <div className="panel">
      <div className="panel-header">
        <h3>🗂 데이터셋</h3>
      </div>
      <div className="panel-body">
        <h3 style={{ fontSize: "14px", fontWeight: 600, marginBottom: 8, color: "#666" }}>데이터셋 선택</h3>
        {datasets.length === 0 ? (
          <div style={{ padding: "12px", backgroundColor: "#fff3cd", borderRadius: "6px", border: "1px solid #ffc107", fontSize: "13px", color: "#856404" }}>
            <strong>⚠️ 데이터셋을 불러오는 중...</strong>
            <br />
            <span style={{ fontSize: "12px" }}>백엔드 서버가 실행 중인지 확인하세요.</span>
          </div>
        ) : (
          <select
            value={selectedDatasetId}
            onChange={(e) => {
              const newDatasetId = e.target.value;
              setSelectedDatasetId(newDatasetId);
              setPrevDatasetId(''); // 데이터셋 변경 표시
              setRowRange(null);
              setManualRowStart(0);
              setManualRowEnd(0);
              setStats(null);
              setColumnSearchQuery('');
              setActiveType("__all__");
              // 데이터셋 변경 시 모든 컬럼 표시 (데이터 로드 후 useEffect에서 처리되지만 명시적으로 설정)
            }}
            className="select-input"
          >
            {datasets.map((ds) => (
              <option key={ds.dataset_id} value={ds.dataset_id}>
                {ds.filename} ({ds.columns.length} 컬럼)
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
};
