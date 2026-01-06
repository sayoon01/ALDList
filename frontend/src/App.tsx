import React, { useState } from 'react';
import { DatasetPicker } from './components/DatasetPicker';
import { DataTable } from './components/DataTable';
import { StatsPanel } from './components/StatsPanel';
import { DatasetInfo } from './api';
import './App.css';

function App() {
  const [selectedDataset, setSelectedDataset] = useState<DatasetInfo | null>(null);

  return (
    <div className="App" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '30px' }}>
        <h1 style={{ margin: 0, color: '#1976d2' }}>ALDLIST</h1>
        <p style={{ color: '#666', marginTop: '5px' }}>CSV 데이터셋 관리 및 조회 시스템</p>
      </header>

      <StatsPanel />

      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <DatasetPicker
          onSelect={setSelectedDataset}
          selectedDataset={selectedDataset?.name || null}
        />
        <DataTable datasetName={selectedDataset?.name || null} />
      </div>
    </div>
  );
}

export default App;

