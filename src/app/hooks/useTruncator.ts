// src/hooks/useTruncator.ts
import { useCallback, useEffect, useRef, useState } from "react";

export interface TruncatorProgress {
  packets: number;
  bytesProcessed: number;
  bytesTotal: number;
}

export interface TruncatorResult {
  tempName: string;
  stats: {
    packetsRead: number;
    packetsTruncated: number;
    bytesIn: number;
    bytesOut: number;
  };
}

export function useTruncator() {
  const workerRef = useRef<Worker | null>(null);
  const [progress, setProgress] = useState<TruncatorProgress | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return () => workerRef.current?.terminate();
  }, []);

  const truncate = useCallback(
    (file: File, snaplen = 120): Promise<TruncatorResult> => {
      return new Promise((resolve, reject) => {
        // Vite's recommended worker import syntax.
        const worker = new Worker(
          new URL("../workers/pcapTruncator.worker.ts", import.meta.url),
          { type: "module" },
        );
        workerRef.current = worker;
        setBusy(true);
        setProgress({ packets: 0, bytesProcessed: 0, bytesTotal: file.size });

        worker.onmessage = (ev) => {
          const m = ev.data;
          switch (m.type) {
            case "progress":
              setProgress({
                packets: m.packets,
                bytesProcessed: m.bytesProcessed,
                bytesTotal: m.bytesTotal,
              });
              break;
            case "done":
              setBusy(false);
              worker.terminate();
              workerRef.current = null;
              resolve({ tempName: m.tempName, stats: m.stats });
              break;
            case "cancelled":
              setBusy(false);
              worker.terminate();
              workerRef.current = null;
              reject(new DOMException("Truncation cancelled", "AbortError"));
              break;
            case "error":
              setBusy(false);
              worker.terminate();
              workerRef.current = null;
              reject(new Error(m.message));
              break;
          }
        };

        worker.onerror = (e) => {
          setBusy(false);
          reject(new Error(e.message || "Worker error"));
        };

        worker.postMessage({ type: "start", file, snaplen });
      });
    },
    [],
  );

  const cancel = useCallback(() => {
    workerRef.current?.postMessage({ type: "cancel" });
  }, []);

  return { truncate, cancel, progress, busy };
}
