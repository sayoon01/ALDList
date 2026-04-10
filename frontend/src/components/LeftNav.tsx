import { LeftTab } from '../types';

interface LeftNavProps {
  leftTab: LeftTab;
  setLeftTab: (tab: LeftTab) => void;
  navSummary: (tab: LeftTab) => string;
}

export const LeftNav = ({ leftTab, setLeftTab, navSummary }: LeftNavProps) => {
  const items: Array<{key: LeftTab; label: string; icon: string}> = [
    { key: "dataset", label: "데이터셋", icon: "🗂" },
    { key: "stats", label: "통계", icon: "📊" },
    { key: "analysis", label: "분석", icon: "🧠" },
    { key: "columns", label: "컬럼", icon: "🧩" },
  ];

  return (
    <div className="nav-list">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          className={`nav-item ${leftTab === it.key ? "active" : ""}`}
          onClick={() => setLeftTab(it.key)}
        >
          <div className="nav-main">
            <span className="nav-icon">{it.icon}</span>
            <span className="nav-label">{it.label}</span>
          </div>

          <div className="nav-sub">
            {navSummary(it.key)}
          </div>

          <span className="nav-chev">
            {leftTab === it.key ? "⌄" : "›"}
          </span>
        </button>
      ))}
    </div>
  );
};
