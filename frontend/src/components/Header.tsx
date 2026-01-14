import "./Header.css";

function Header() {
  return (
    <header className="app-header">
      <div className="app-header-left">
        <div className="app-badge">ALD</div>
        <div className="app-title-wrap">
          <div className="app-title">ALDList</div>
          <div className="app-subtitle">CSV Explorer · DuckDB · FastAPI</div>
        </div>
      </div>
    </header>
  );
}

export default Header;
