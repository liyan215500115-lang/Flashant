export async function uploadImageBlob(
  blob: Blob,
  fileName: string
): Promise<{ s3Key: string; publicUrl: string }> {
  const mimeType = blob.type || "image/png";
  const file = new File([blob], fileName, { type: mimeType });
  const urlRes = await fetch(
    `/api/upload-url?fileName=${encodeURIComponent(fileName)}&mimeType=${encodeURIComponent(mimeType)}`
  );
  if (!urlRes.ok) throw new Error("Failed to get upload URL");
  const config = await urlRes.json();

  if (config.mode === "local") {
    const formData = new FormData();
    formData.append("file", file);
    const localRes = await fetch("/api/upload-url", { method: "POST", body: formData });
    if (!localRes.ok) throw new Error("Upload failed");
    const localData = await localRes.json();
    return { s3Key: localData.s3Key, publicUrl: localData.publicUrl };
  }

  const uploadRes = await fetch(config.uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": mimeType },
  });
  if (!uploadRes.ok) throw new Error(`Upload failed (${uploadRes.status})`);
  return { s3Key: config.s3Key, publicUrl: config.publicUrl };
}

export async function saveGeneratedImage(
  projectId: string,
  blob: Blob,
  options: { fileName: string; productImageId?: string | null; promptUsed?: string }
) {
  const uploaded = await uploadImageBlob(blob, options.fileName);
  const res = await fetch(`/api/products/${projectId}/generated`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      s3Key: uploaded.s3Key,
      url: uploaded.publicUrl,
      fileName: options.fileName,
      fileSize: blob.size,
      mimeType: blob.type || "image/png",
      productImageId: options.productImageId || null,
      promptUsed: options.promptUsed ?? "manual-edit",
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Failed to save image");
  }
  return res.json();
}
