import React, { useState, useEffect } from 'react';
import { datasetsApi, DatasetInfo } from '../api';

interface DatasetPickerProps {
  onSelect: (dataset: DatasetInfo | null) => void;
  selectedDataset?: string | null;
}

export const DatasetPicker: React.FC<DatasetPickerProps> = ({ onSelect, selectedDataset }) => {
  const [datasets, setDatasets] = useState<DatasetInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDatasets();
  }, []);

  const loadDatasets = async () => {
    try {
      setLoading(true);
      const data = await datasetsApi.list();
      setDatasets(data);
      setError(null);
    } catch (err) {
      setError('데이터셋 목록을 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedName = event.target.value;
    if (selectedName) {
      const dataset = datasets.find(d => d.name === selectedName);
      onSelect(dataset || null);
    } else {
      onSelect(null);
    }
  };

  if (loading) {
    return <div>로딩 중...</div>;
  }

  if (error) {
    return <div style={{ color: 'red' }}>{error}</div>;
  }

  return (
    <div style={{ marginBottom: '20px' }}>
      <label htmlFor="dataset-select" style={{ marginRight: '10px', fontWeight: 'bold' }}>
        데이터셋 선택:
      </label>
      <select
        id="dataset-select"
        value={selectedDataset || ''}
        onChange={handleChange}
        style={{
          padding: '8px',
          fontSize: '14px',
          minWidth: '300px',
          borderRadius: '4px',
          border: '1px solid #ccc',
        }}
      >
        <option value="">-- 데이터셋을 선택하세요 --</option>
        {datasets.map(dataset => (
          <option key={dataset.name} value={dataset.name}>
            {dataset.name} ({dataset.column_count}개 컬럼, {dataset.row_count.toLocaleString()}개 행)
          </option>
        ))}
      </select>
    </div>
  );
};

