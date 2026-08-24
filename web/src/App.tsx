import ErrorBoundary from "./components/ErrorBoundary";
import SearchBar from "./components/SearchBar";
import ThemeToggle from "./components/ThemeToggle";
import BinDetail from "./pages/BinDetail";
import Loans from "./pages/Loans";
import Locations from "./pages/Locations";
import PrintSheet from "./pages/PrintSheet";
import Scan from "./pages/Scan";
import { navigate, usePath } from "./router";

export default function App() {
  const path = usePath();
  const binCodeMatch = path.match(/^\/b\/([^/]+)$/);

  let content;
  let activeTab: "locations" | "scan" | "print" | "loans" = "locations";
  if (binCodeMatch) {
    content = <BinDetail code={decodeURIComponent(binCodeMatch[1])} />;
  } else if (path === "/scan") {
    content = <Scan />;
    activeTab = "scan";
  } else if (path === "/print") {
    content = <PrintSheet />;
    activeTab = "print";
  } else if (path === "/loans") {
    content = <Loans />;
    activeTab = "loans";
  } else {
    content = <Locations />;
  }

  return (
    <div>
      {path !== "/print" && (
        <div className="page-header no-print">
          <h1>Binventory</h1>
          <ThemeToggle />
        </div>
      )}
      <nav className="no-print">
        <button className={activeTab === "locations" ? "selected" : ""} onClick={() => navigate("/")}>
          Locations
        </button>
        <button className={activeTab === "scan" ? "selected" : ""} onClick={() => navigate("/scan")}>
          Scan
        </button>
        <button className={activeTab === "print" ? "selected" : ""} onClick={() => navigate("/print")}>
          Print labels
        </button>
        <button className={activeTab === "loans" ? "selected" : ""} onClick={() => navigate("/loans")}>
          Loans
        </button>
      </nav>
      <div className="no-print">
        <SearchBar />
      </div>
      <ErrorBoundary key={path}>{content}</ErrorBoundary>
    </div>
  );
}
