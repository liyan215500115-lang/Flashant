export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadUrl(url: string, fileName: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`download failed (${res.status})`);
    downloadBlob(await res.blob(), fileName);
    return true;
  } catch {
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
      return true;
    } catch {
      return false;
    }
  }
}

export async function downloadUrls(items: { url: string; fileName: string }[]) {
  let failed = 0;
  for (let i = 0; i < items.length; i++) {
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, 200));
    const ok = await downloadUrl(items[i].url, items[i].fileName);
    if (!ok) failed++;
  }
  return { failed, total: items.length };
}
