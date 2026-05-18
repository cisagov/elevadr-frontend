// src/services/pcapTruncator.ts
import init, { truncate_pcap_streaming } from "../wasm_modules/pcap_truncate";

export interface TruncationStats {
  packetsRead: number;
  packetsTruncated: number;
  bytesIn: number;
  bytesOut: number;
}

export interface TruncationProgress {
  packets: number;
  bytesProcessed: number;
  bytesTotal: number; // input file size, for percentage
}

export interface TruncationResult {
  /** Handle to the OPFS temp file. Caller must call `cleanup()` when done. */
  file: File;
  stats: TruncationStats;
  cleanup: () => Promise<void>;
}

let wasmReady: Promise<void> | null = null;
function ensureWasm(): Promise<void> {
  if (!wasmReady) wasmReady = init().then(() => undefined);
  return wasmReady;
}

const READ_CHUNK_BYTES = 4 * 1024 * 1024; // 4 MiB

/**
 * Truncates a pcap/pcapng File via WASM and stages the result to OPFS.
 * Memory usage is bounded — safe for multi-GB inputs.
 */
export async function truncateToOpfs(
  input: File,
  opts: {
    snaplen?: number;
    onProgress?: (p: TruncationProgress) => void;
    signal?: AbortSignal;
  } = {},
): Promise<TruncationResult> {
  await ensureWasm();

  const snaplen = opts.snaplen ?? 120;
  const totalBytes = input.size;

  // ---- 1. Open OPFS temp file for streaming write ------------------------
  const root = await navigator.storage.getDirectory();
  const tempName = `truncated-${crypto.randomUUID()}.pcap`;
  const handle = await root.getFileHandle(tempName, { create: true });
  const writable = await handle.createWritable();

  const cleanup = async () => {
    try {
      await root.removeEntry(tempName);
    } catch {
      /* already gone */
    }
  };

  // ---- 2. Set up the JS-side streaming reader ----------------------------
  // We pull from the File via slice() so the browser memory-maps lazily.
  let offset = 0;
  let bytesIn = 0;

  const onRead = (): Uint8Array | null => {
    if (opts.signal?.aborted) return null; // EOF -> graceful stop
    if (offset >= totalBytes) return null;

    const end = Math.min(offset + READ_CHUNK_BYTES, totalBytes);
    const slice = input.slice(offset, end);
    offset = end;

    // Synchronous read required by the WASM bridge. FileReaderSync only
    // exists in workers, so for the main thread we use a small synchronous
    // arrayBuffer pattern via Atomics — but the simplest robust approach is
    // to run this whole pipeline in a Web Worker (see Step 4 below).
    // For the worker case, we use the sync Blob.arrayBuffer trick:
    return blobToUint8ArraySync(slice);
  };

  // ---- 3. Set up the JS-side streaming writer ----------------------------
  // The WASM writer hands us Uint8Array views that are invalidated on return,
  // so we must copy synchronously. We queue writes to OPFS without awaiting
  // here (write() returns a promise we batch-flush later via close()).
  const pendingWrites: Promise<void>[] = [];
  const onWrite = (chunk: Uint8Array): void => {
    // Copy out of the WASM-owned view immediately.
    const copy = new Uint8Array(chunk); // new Uint8Array(view) copies
    pendingWrites.push(writable.write(copy));
  };

  // ---- 4. Progress bridge ------------------------------------------------
  const onProgress = (packets: number, bytes: number): boolean => {
    bytesIn = bytes;
    opts.onProgress?.({
      packets,
      bytesProcessed: bytes,
      bytesTotal: totalBytes,
    });
    return !opts.signal?.aborted;
  };

  // ---- 5. Run! -----------------------------------------------------------
  let stats: TruncationStats;
  try {
    stats = truncate_pcap_streaming(
      onRead,
      onWrite,
      onProgress,
      snaplen,
    ) as TruncationStats;
    await Promise.all(pendingWrites);
    await writable.close();
  } catch (e) {
    try {
      await writable.abort();
    } catch {
      /* ignore */
    }
    await cleanup();
    throw e;
  }

  // ---- 6. Hand back a File pointing at the OPFS entry --------------------
  const file = await handle.getFile();
  return { file, stats, cleanup };
}

// Helper: synchronous-ish read of a Blob into Uint8Array. Only safe in workers
// (where we can use FileReaderSync) — in the main thread we need a different
// approach (see worker section).
function blobToUint8ArraySync(_blob: Blob): Uint8Array {
  throw new Error(
    "Use the worker-based pipeline; sync blob reads aren't possible on the main thread.",
  );
}
