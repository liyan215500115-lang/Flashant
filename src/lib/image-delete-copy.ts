export function imageDeleteConfirmCopy(input: {
  count: number;
  removesDerivatives: boolean;
}): { title: string; description: string; confirmLabel: string } {
  const count = Math.max(1, Math.floor(input.count));
  const title = count > 1 ? "删除选中图片" : "删除图片";
  const description =
    count > 1
      ? `确定要删除选中的 ${count} 张图片吗？此操作不可撤销。`
      : "确定要删除这张图片吗？此操作不可撤销。";
  const derivativeWarning = input.removesDerivatives
    ? "删除产品原图时，由它生成的图片也会一并删除。"
    : "";

  return {
    title,
    description: derivativeWarning ? `${description}${derivativeWarning}` : description,
    confirmLabel: count > 1 ? `删除 ${count} 张` : "删除",
  };
}
