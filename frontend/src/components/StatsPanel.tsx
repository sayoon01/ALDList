import React, { useState, useEffect } from 'react';
import { statsApi, StatsResponse } from '../api';

export const StatsPanel: React.FC = () => {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await statsApi.get();
      setStats(data);
      setError(null);
    } catch (err) {
      setError('통계 정보를 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>로딩 중...</div>;
  }

  if (error) {
    return <div style={{ color: 'red' }}>{error}</div>;
  }

  if (!stats) {
    return null;
  }

  return (
    <div
      style={{
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '20px',
        backgroundColor: '#f5f5f5',
        marginBottom: '20px',
      }}
    >
      <h2 style={{ marginTop: 0, marginBottom: '15px' }}>전체 통계</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
        <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '4px' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1976d2' }}>
            {stats.total_datasets}
          </div>
          <div style={{ color: '#666', fontSize: '14px' }}>총 데이터셋</div>
        </div>
        <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '4px' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1976d2' }}>
            {stats.total_rows.toLocaleString()}
          </div>
          <div style={{ color: '#666', fontSize: '14px' }}>총 행 수</div>
        </div>
        <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '4px' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1976d2' }}>
            {stats.total_columns}
          </div>
          <div style={{ color: '#666', fontSize: '14px' }}>Union 컬럼 수</div>
        </div>
        <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '4px' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1976d2' }}>
            {stats.intersection_columns.length}
          </div>
          <div style={{ color: '#666', fontSize: '14px' }}>Intersection 컬럼 수</div>
        </div>
      </div>
    </div>
  );
};

