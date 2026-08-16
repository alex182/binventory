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
  if (binCodeMatch) {
    content = <BinDetail code={decodeURIComponent(binCodeMatch[1])} />;
  } else if (path === "/scan") {
    content = <Scan />;
  } else if (path === "/print") {
    content = <PrintSheet />;
  } else if (path === "/loans") {
    content = <Loans />;
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
        <button onClick={() => navigate("/")}>Locations</button>
        <button onClick={() => navigate("/scan")}>Scan</button>
        <button onClick={() => navigate("/print")}>Print labels</button>
        <button onClick={() => navigate("/loans")}>Loans</button>
      </nav>
      <div className="no-print">
        <SearchBar />
      </div>
      <ErrorBoundary key={path}>{content}</ErrorBoundary>
    </div>
  );
}
