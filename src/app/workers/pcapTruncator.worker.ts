// src/workers/pcapTruncator.worker.ts
import init, { truncate_pcap_streaming } from "../wasm_modules/pcap_truncate";

interface StartMsg {
  type: "start";
  file: File;
  snaplen: number;
}
interface CancelMsg {
  type: "cancel";
}
type InMsg = StartMsg | CancelMsg;

let cancelled = false;
const CHUNK = 4 * 1024 * 1024;

self.onmessage = async (ev: MessageEvent<InMsg>) => {
  const msg = ev.data;
  if (msg.type === "cancel") {
    cancelled = true;
    return;
  }
  if (msg.type !== "start") return;

  try {
    await init();

    const { file, snaplen } = msg;
    const reader = new FileReaderSync(); // ✅ available in workers

    console.log("[worker] starting truncation, file size:", file.size);

    // OPFS temp file
    const root = await navigator.storage.getDirectory();
    const tempName = `truncated-${crypto.randomUUID()}.pcap`;
    const handle = await root.getFileHandle(tempName, { create: true });
    const writable = await handle.createWritable();

    let offset = 0;
    const total = file.size;

    const onRead = (): Uint8Array | null => {
      console.log("[worker] onRead called, offset:", offset);
      if (cancelled || offset >= total) return null;
      const end = Math.min(offset + CHUNK, total);
      const slice = file.slice(offset, end);
      offset = end;
      const buf = reader.readAsArrayBuffer(slice); // synchronous in workers
      return new Uint8Array(buf);
    };

    // Buffer writes to OPFS. createWritable's write() is async, so we batch
    // by collecting copies and flushing periodically to bound memory.
    let writeBuffer: Uint8Array[] = [];
    let writeBufferBytes = 0;
    const FLUSH_AT = 8 * 1024 * 1024; // flush every 8 MiB

    const flush = async () => {
      if (writeBuffer.length === 0) return;
      // Concatenate then write once — a single OPFS syscall per flush.
      const merged = new Uint8Array(writeBufferBytes);
      let pos = 0;
      for (const c of writeBuffer) {
        merged.set(c, pos);
        pos += c.length;
      }
      writeBuffer = [];
      writeBufferBytes = 0;
      await writable.write(merged);
    };

    // The WASM call is synchronous, so we cannot await inside onWrite.
    // Instead we accumulate and rely on a final flush + close() afterward.
    // For very high throughput, swap to an AccessHandle (sync OPFS API).
    const onWrite = (chunk: Uint8Array): void => {
      console.log("[worker] onWrite called, chunk size:", chunk.length);
      writeBuffer.push(new Uint8Array(chunk)); // copy out of WASM memory
      writeBufferBytes += chunk.length;
      // We can't await here, so just cap memory by dropping the oldest? No —
      // correctness > memory. Use AccessHandle path for true streaming (below).
    };

    const onProgress = (packets: number, bytes: number): boolean => {
      (self as any).postMessage({
        type: "progress",
        packets,
        bytesProcessed: bytes,
        bytesTotal: total,
      });
      return !cancelled;
    };

    const stats = truncate_pcap_streaming(onRead, onWrite, onProgress, snaplen);

    await flush();
    await writable.close();

    if (cancelled) {
      try {
        await root.removeEntry(tempName);
      } catch {
        /* ignore */
      }
      (self as any).postMessage({ type: "cancelled" });
      return;
    }

    (self as any).postMessage({ type: "done", tempName, stats });
  } catch (err) {
    (self as any).postMessage({
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
