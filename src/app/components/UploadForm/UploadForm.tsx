import React, {
  useState,
  FormEvent,
  useRef,
  SetStateAction,
  Dispatch,
  ChangeEvent,
} from "react";
import { ElevadrReport } from "../../types/Report";
import "./UploadForm.css";
import { useTruncator } from "@/hooks/useTruncator";
import { getOpfsFile, removeOpfsFile } from "@/services/opfs";

const BACKEND_HTTP = "http://localhost:8000";
const BACKEND_WS = "ws://localhost:8000";

interface ProgressEvent {
  stage: string;
  progress: number;
  message: string;
}

interface UploadFormProps {
  onReportLoaded: (report: ElevadrReport) => void;
  report: ElevadrReport | null;
  onDownloadJson: () => void;
  isAnalyzing: boolean;
  setIsAnalyzing?: Dispatch<SetStateAction<boolean>>;
}

const UploadForm: React.FC<UploadFormProps> = ({
  onReportLoaded,
  report,
  onDownloadJson,
  isAnalyzing,
  setIsAnalyzing,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [shouldTruncate, setShouldTruncate] = useState<boolean>(true); // Default to truncate
  const wsRef = useRef<WebSocket | null>(null);

  // Truncation hook
  const {
    truncate,
    cancel: cancelTruncation,
    progress: truncProgress,
    busy: truncating,
  } = useTruncator();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setProgress(null);

    if (!file) {
      setError("Please select a PCAP file to upload.");
      return;
    }

    setIsAnalyzing?.(true);

    let tempName: string | null = null;
    let fileToUpload: File;

    if (shouldTruncate) {
      // Step A: truncate the file in-browser to an OPFS temp file
      try {
        const result = await truncate(file, 120);
        tempName = result.tempName;
        fileToUpload = await getOpfsFile(tempName);
        console.log("Truncation stats:", result.stats);
      } catch (err) {
        setIsAnalyzing?.(false);
        setError(err instanceof Error ? err.message : "Truncation failed");
        return;
      }
    } else {
      fileToUpload = file;
    }

    // Step B: existing WebSocket + analyze flow
    const sessionId = crypto.randomUUID();
    const ws = new WebSocket(`${BACKEND_WS}/ws/progress/${sessionId}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data) as ProgressEvent;
      setProgress(data);
    };

    ws.onerror = () => {
      console.warn(
        "Progress WebSocket error - continuing without progress updates",
      );
    };

    try {
      const formData = new FormData();
      formData.append("file", fileToUpload, file.name);

      const response = await fetch(
        `${BACKEND_HTTP}/analyze?session_id=${sessionId}`,
        { method: "POST", body: formData },
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          text || `Analysis failed with status ${response.status}`,
        );
      }

      const data = (await response.json()) as ElevadrReport;
      if (!data.executive_summary || !data.modules) {
        throw new Error("Invalid report format returned from backend.");
      }
      onReportLoaded(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run analysis");
    } finally {
      setIsAnalyzing?.(false);
      wsRef.current?.close();
      wsRef.current = null;

      // Step C: clean up the OPFS temp file if we created one
      if (tempName) await removeOpfsFile(tempName);
    }
  };

  const handleTruncateChange = (e: ChangeEvent<HTMLInputElement>) => {
    setShouldTruncate(e.target.checked);
  };

  const renderTruncProgress = () => {
    if (!truncating || !truncProgress) return null;
    const pct =
      truncProgress.bytesTotal > 0
        ? (truncProgress.bytesProcessed / truncProgress.bytesTotal) * 100
        : 0;
    return (
      <div className="truncation-progress">
        <div>
          Truncating: {truncProgress.packets.toLocaleString()} packets (
          {pct.toFixed(1)}%)
        </div>
        <progress
          value={truncProgress.bytesProcessed}
          max={truncProgress.bytesTotal}
        />
        <button type="button" onClick={cancelTruncation}>
          Cancel
        </button>
      </div>
    );
  };

  return (
    <div className="upload-container">
      {/* PCAP upload form */}
      <form onSubmit={handleSubmit} className="upload-form">
        <label htmlFor="pcap-upload" className="upload-label">
          Upload PCAP for Analysis
        </label>
        <input
          id="pcap-upload"
          type="file"
          accept=".pcap,.pcapng"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />

        <div className="truncate-option">
          <input
            type="checkbox"
            id="truncate-checkbox"
            checked={shouldTruncate}
            onChange={handleTruncateChange}
          />
          <label htmlFor="truncate-checkbox">
            Truncate PCAP to first 120 packets (recommended for large files)
          </label>
        </div>

        <div className="form-actions">
          <button type="submit" disabled={!file || isAnalyzing}>
            {isAnalyzing ? "Analyzing..." : "Run Analysis"}
          </button>
          <button
            type="button"
            onClick={onDownloadJson}
            disabled={!report || isAnalyzing}
            className="download-button"
          >
            Download JSON Report
          </button>
        </div>

        {renderTruncProgress()}
      </form>

      {/* Progress bar (shown only during PCAP analysis) */}
      {isAnalyzing && (
        <div className="upload-status">
          <p className="loading-text">
            {progress?.message ?? "Starting analysis..."}
          </p>
          <div className="progress-bar-track">
            <div
              className="progress-bar-fill"
              style={{ width: `${progress?.progress ?? 0}%` }}
            />
          </div>
          <p className="progress-percent">{progress?.progress ?? 0}%</p>
        </div>
      )}

      {/* Error handling */}
      {error && (
        <div className="error-container">
          <p className="error-text">Error during analysis</p>
          <p className="error-details">{error}</p>
        </div>
      )}
    </div>
  );
};

export default UploadForm;
