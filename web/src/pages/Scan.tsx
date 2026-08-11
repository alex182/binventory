import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { navigate } from "../router";

const REGION_ID = "qr-reader";

function extractCode(scannedText: string): string {
  const withoutQuery = scannedText.split(/[?#]/)[0];
  const parts = withoutQuery.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? scannedText;
}

function describeError(err: unknown): string {
  if (err instanceof Error) {
    return `${err.name}: ${err.message}`;
  }
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export default function Scan() {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    function log(message: string) {
      const line = `${new Date().toLocaleTimeString()}  ${message}`;
      console.log("[Scan]", message);
      setLogs((prev) => [...prev.slice(-49), line]);
    }

    log(`Page loaded. URL: ${window.location.href}`);
    log(`Secure context: ${window.isSecureContext}`);
    log(`navigator.mediaDevices available: ${!!navigator.mediaDevices}`);
    log(`User agent: ${navigator.userAgent}`);

    let cancelled = false;

    async function start() {
      try {
        log("Requesting camera list (Html5Qrcode.getCameras)…");
        const cameras = await Html5Qrcode.getCameras();
        log(
          `Cameras found: ${cameras.length}${
            cameras.length ? " — " + cameras.map((c) => c.label || c.id).join(", ") : ""
          }`,
        );
      } catch (err) {
        log(`getCameras() failed: ${describeError(err)}`);
      }

      if (cancelled) return;

      const scanner = new Html5Qrcode(REGION_ID);
      scannerRef.current = scanner;
      log("Html5Qrcode instance created. Calling start()…");

      let frameCount = 0;
      let lastHeartbeat = Date.now();

      scanner
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 250 },
          (decodedText) => {
            log(`Decoded QR: "${decodedText}"`);
            const code = extractCode(decodedText);
            log(`Extracted code: "${code}" — navigating to /b/${code}`);
            scanner.stop().catch((err) => log(`stop() after decode failed: ${describeError(err)}`));
            navigate(`/b/${encodeURIComponent(code)}`);
          },
          () => {
            // Fires continuously (per frame) while no QR is in view — far too
            // noisy to log every call, so just emit an occasional heartbeat
            // to confirm scanning is actually active rather than stalled.
            frameCount += 1;
            const now = Date.now();
            if (now - lastHeartbeat > 5000) {
              log(`Still scanning… (${frameCount} frames processed, no QR found yet)`);
              lastHeartbeat = now;
            }
          },
        )
        .then(() => {
          log("scanner.start() resolved — camera should be live now.");
          const region = document.getElementById(REGION_ID);
          log(`#${REGION_ID} child element count: ${region?.children.length ?? "region not found"}`);
        })
        .catch((err) => {
          const message = describeError(err);
          log(`scanner.start() FAILED: ${message}`);
          setError(message);
        });
    }

    start();

    return () => {
      cancelled = true;
      scannerRef.current?.stop().catch((err) => log(`cleanup stop() failed: ${describeError(err)}`));
    };
  }, []);

  return (
    <div className="scan-page">
      <h2>Scan a bin</h2>
      {error && <p className="error">Camera error: {error}</p>}
      <div id={REGION_ID} />
      <details className="scan-debug" open>
        <summary>Debug log ({logs.length})</summary>
        <pre>{logs.join("\n")}</pre>
      </details>
    </div>
  );
}
