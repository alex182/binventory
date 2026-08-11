import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { navigate } from "../router";

const REGION_ID = "qr-reader";

function extractCode(scannedText: string): string {
  const withoutQuery = scannedText.split(/[?#]/)[0];
  const parts = withoutQuery.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? scannedText;
}

export default function Scan() {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const scanner = new Html5Qrcode(REGION_ID);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        (decodedText) => {
          const code = extractCode(decodedText);
          scanner.stop().catch(() => {});
          navigate(`/b/${encodeURIComponent(code)}`);
        },
        undefined,
      )
      .catch((err) => setError(String(err)));

    return () => {
      scanner.stop().catch(() => {});
    };
  }, []);

  return (
    <div className="scan-page">
      <h2>Scan a bin</h2>
      {error && <p className="error">Camera error: {error}</p>}
      <div id={REGION_ID} />
    </div>
  );
}
