import { fillTemplate } from "@/lib/generated-image-display";

export function imageDeleteConfirmCopy(input: {
  count: number;
  removesDerivatives: boolean;
  t: (key: string) => string;
}): { title: string; description: string; confirmLabel: string } {
  const count = Math.max(1, Math.floor(input.count));
  const title = count > 1 ? input.t("detail.deleteSelectedTitle") : input.t("detail.deleteImageTitle");
  const description = count > 1
    ? fillTemplate(input.t("detail.deleteSelectedDesc"), { count })
    : input.t("detail.deleteImageDesc");
  const derivativeWarning = input.removesDerivatives ? input.t("detail.deleteOriginalAlso") : "";

  return {
    title,
    description: derivativeWarning ? `${description}${derivativeWarning}` : description,
    confirmLabel: count > 1 ? fillTemplate(input.t("detail.deleteCount"), { count }) : input.t("detail.delete"),
  };
}
