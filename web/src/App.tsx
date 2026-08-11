import BinDetail from "./pages/BinDetail";
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
  } else {
    content = <Locations />;
  }

  return (
    <div>
      <h1 className="no-print">Binventory</h1>
      <nav className="no-print">
        <button onClick={() => navigate("/")}>Locations</button>
        <button onClick={() => navigate("/scan")}>Scan</button>
        <button onClick={() => navigate("/print")}>Print labels</button>
      </nav>
      {content}
    </div>
  );
}
