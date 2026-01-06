import React, { useState, useEffect } from 'react';
import { datasetsApi, DatasetDetail } from '../api';

interface DataTableProps {
  datasetName: string | null;
}

export const DataTable: React.FC<DataTableProps> = ({ datasetName }) => {
  const [dataset, setDataset] = useState<DatasetDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (datasetName) {
      loadDataset();
    } else {
      setDataset(null);
    }
  }, [datasetName]);

  const loadDataset = async () => {
    if (!datasetName) return;

    try {
      setLoading(true);
      const data = await datasetsApi.get(datasetName);
      setDataset(data);
      setError(null);
    } catch (err) {
      setError('데이터셋 정보를 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!datasetName) {
    return <div style={{ padding: '20px', color: '#666' }}>데이터셋을 선택해주세요.</div>;
  }

  if (loading) {
    return <div style={{ padding: '20px' }}>로딩 중...</div>;
  }

  if (error) {
    return <div style={{ padding: '20px', color: 'red' }}>{error}</div>;
  }

  if (!dataset) {
    return null;
  }

  return (
    <div style={{ marginTop: '20px' }}>
      <h2 style={{ marginBottom: '10px' }}>{dataset.name}</h2>
      <div style={{ marginBottom: '15px', color: '#666' }}>
        <strong>경로:</strong> {dataset.path} |{' '}
        <strong>컬럼 수:</strong> {dataset.column_count} |{' '}
        <strong>행 수:</strong> {dataset.row_count.toLocaleString()}
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>컬럼 목록 ({dataset.columns.length}개):</strong>
      </div>
      <div
        style={{
          border: '1px solid #ddd',
          borderRadius: '4px',
          padding: '15px',
          maxHeight: '400px',
          overflowY: 'auto',
          backgroundColor: '#f9f9f9',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {dataset.columns.map((column, index) => (
            <span
              key={index}
              style={{
                padding: '4px 8px',
                backgroundColor: '#e3f2fd',
                borderRadius: '4px',
                fontSize: '12px',
                fontFamily: 'monospace',
              }}
            >
              {column}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};


