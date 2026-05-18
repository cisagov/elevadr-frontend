export async function getOpfsFile(name: string): Promise<File> {
  const root = await navigator.storage.getDirectory();
  const handle = await root.getFileHandle(name);
  return handle.getFile();
}

export async function removeOpfsFile(name: string): Promise<void> {
  const root = await navigator.storage.getDirectory();
  try {
    await root.removeEntry(name);
  } catch {
    /* already gone */
  }
}

// src/services/opfsCleanup.ts
export async function sweepStaleTempFiles(maxAgeMs = 24 * 60 * 60 * 1000) {
  try {
    const root = await navigator.storage.getDirectory();
    const now = Date.now();
    for await (const [name, handle] of (root as any).entries()) {
      if (!name.startsWith("truncated-")) continue;
      if (handle.kind !== "file") continue;
      const f = await (handle as FileSystemFileHandle).getFile();
      if (now - f.lastModified > maxAgeMs) {
        await root.removeEntry(name);
      }
    }
  } catch {
    /* OPFS not available; ignore */
  }
}
