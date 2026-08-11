import BinDetail from "./pages/BinDetail";
import Locations from "./pages/Locations";
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
  } else {
    content = <Locations />;
  }

  return (
    <div>
      <h1>Binventory</h1>
      <nav>
        <button onClick={() => navigate("/")}>Locations</button>
        <button onClick={() => navigate("/scan")}>Scan</button>
      </nav>
      {content}
    </div>
  );
}
