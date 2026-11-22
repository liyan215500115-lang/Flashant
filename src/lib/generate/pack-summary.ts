import { resolveLocale, type AppLocale } from "@/lib/locales";

export interface PackCreditCounts {
  completed: number;
  requested: number;
  /** Credits kept for shots that were stored. */
  creditsCharged: number;
  /** Debits that were reversed because that shot failed. */
  creditsRefunded: number;
  /** Failed shots that never took a debit. */
  notCharged: number;
  /** Failed shots that were debited and could not be reversed. */
  unrefunded?: number;
  locale?: string;
}

interface PackCreditView {
  completed: number;
  requested: number;
  charged: number;
  refunded: number;
  notCharged: number;
  unrefunded: number;
  failed: number;
}

function viewOf(input: PackCreditCounts): PackCreditView {
  const completed = Math.max(0, Math.floor(input.completed));
  const requested = Math.max(completed, Math.floor(input.requested));
  return {
    completed,
    requested,
    charged: Math.max(0, Math.floor(input.creditsCharged)),
    refunded: Math.max(0, Math.floor(input.creditsRefunded)),
    notCharged: Math.max(0, Math.floor(input.notCharged)),
    unrefunded: Math.max(0, Math.floor(input.unrefunded ?? 0)),
    failed: Math.max(0, requested - completed),
  };
}

function joinFailure(locale: AppLocale, view: PackCreditView): string {
  const { failed, refunded, notCharged, unrefunded } = view;
  if (failed <= 0) return "";
  if (locale === "zh") {
    const bits: string[] = [];
    if (refunded > 0) bits.push(`已退回 ${refunded} 点额度`);
    if (notCharged > 0) bits.push(`${notCharged} 张未扣费`);
    if (unrefunded > 0) bits.push(`${unrefunded} 点额度扣费未能退回`);
    return bits.length > 0
      ? `未成功 ${failed} 张：${bits.join("，")}`
      : `未成功 ${failed} 张`;
  }
  if (locale === "ja") {
    const bits: string[] = [];
    if (refunded > 0) bits.push(`${refunded} 返還`);
    if (notCharged > 0) bits.push(`${notCharged} 枚は未課金`);
    if (unrefunded > 0) bits.push(`${unrefunded} は返還できませんでした`);
    return bits.length > 0 ? `失敗 ${failed} 枚：${bits.join("、")}` : `失敗 ${failed} 枚`;
  }
  if (locale === "ko") {
    const bits: string[] = [];
    if (refunded > 0) bits.push(`${refunded} 환불`);
    if (notCharged > 0) bits.push(`${notCharged}장은 차감되지 않음`);
    if (unrefunded > 0) bits.push(`${unrefunded}은 환불되지 않음`);
    return bits.length > 0 ? `실패 ${failed}장: ${bits.join(", ")}` : `실패 ${failed}장`;
  }
  if (locale === "es") {
    const bits: string[] = [];
    if (refunded > 0) bits.push(`${refunded} reembolsado${refunded === 1 ? "" : "s"}`);
    if (notCharged > 0) bits.push(`${notCharged} sin cargo`);
    if (unrefunded > 0) bits.push(`${unrefunded} no reembolsado${unrefunded === 1 ? "" : "s"}`);
    return bits.length > 0 ? `${failed} fallaron: ${bits.join(", ")}` : `${failed} fallaron`;
  }
  if (locale === "fr") {
    const bits: string[] = [];
    if (refunded > 0) bits.push(`${refunded} remboursé${refunded === 1 ? "" : "s"}`);
    if (notCharged > 0) bits.push(`${notCharged} non débité${notCharged === 1 ? "" : "s"}`);
    if (unrefunded > 0) bits.push(`${unrefunded} non remboursé${unrefunded === 1 ? "" : "s"}`);
    return bits.length > 0 ? `${failed} échec${failed === 1 ? "" : "s"} : ${bits.join(", ")}` : `${failed} échec${failed === 1 ? "" : "s"}`;
  }
  if (locale === "de") {
    const bits: string[] = [];
    if (refunded > 0) bits.push(`${refunded} erstattet`);
    if (notCharged > 0) bits.push(`${notCharged} nicht berechnet`);
    if (unrefunded > 0) bits.push(`${unrefunded} nicht erstattet`);
    return bits.length > 0 ? `${failed} fehlgeschlagen: ${bits.join(", ")}` : `${failed} fehlgeschlagen`;
  }
  if (locale === "pt-BR") {
    const bits: string[] = [];
    if (refunded > 0) bits.push(`${refunded} reembolsado${refunded === 1 ? "" : "s"}`);
    if (notCharged > 0) bits.push(`${notCharged} não cobrado${notCharged === 1 ? "" : "s"}`);
    if (unrefunded > 0) bits.push(`${unrefunded} não reembolsado${unrefunded === 1 ? "" : "s"}`);
    return bits.length > 0 ? `${failed} falharam: ${bits.join(", ")}` : `${failed} falharam`;
  }
  if (locale === "it") {
    const bits: string[] = [];
    if (refunded > 0) bits.push(`${refunded} rimborsat${refunded === 1 ? "o" : "i"}`);
    if (notCharged > 0) bits.push(`${notCharged} non addebitat${notCharged === 1 ? "a" : "e"}`);
    if (unrefunded > 0) bits.push(`${unrefunded} non rimborsat${unrefunded === 1 ? "o" : "i"}`);
    return bits.length > 0 ? `${failed} non riuscite: ${bits.join(", ")}` : `${failed} non riuscite`;
  }
  if (locale === "ar") {
    const bits: string[] = [];
    if (refunded > 0) bits.push(`أُعيد ${refunded}`);
    if (notCharged > 0) bits.push(`لم يُخصم ${notCharged}`);
    if (unrefunded > 0) bits.push(`تعذر إرجاع ${unrefunded}`);
    return bits.length > 0 ? `فشل ${failed}: ${bits.join("، ")}` : `فشل ${failed}`;
  }
  const bits: string[] = [];
  if (refunded > 0) bits.push(`refunded ${refunded}`);
  if (notCharged > 0) bits.push(`${notCharged} not charged`);
  if (unrefunded > 0) bits.push(`${unrefunded} not refunded`);
  return bits.length > 0 ? `${failed} failed: ${bits.join(", ")}` : `${failed} failed`;
}

function headLine(locale: AppLocale, view: PackCreditView): string {
  const { completed, requested, charged } = view;
  if (locale === "zh") return `已完成 ${completed}/${requested}，实际扣费 ${charged} 点额度`;
  if (locale === "ja") return `${completed}/${requested} 完了、実際の消費は ${charged} クレジット`;
  if (locale === "ko") return `${completed}/${requested} 완료, 실제 차감 ${charged} 크레딧`;
  if (locale === "es") return `Completadas ${completed}/${requested}, se cobraron ${charged} créditos`;
  if (locale === "fr") return `${completed}/${requested} terminées, ${charged} crédit${charged === 1 ? "" : "s"} débité${charged === 1 ? "" : "s"}`;
  if (locale === "de") return `${completed}/${requested} fertig, ${charged} Credits berechnet`;
  if (locale === "pt-BR") return `${completed}/${requested} concluídas, ${charged} créditos cobrados`;
  if (locale === "it") return `${completed}/${requested} completate, addebitati ${charged} crediti`;
  if (locale === "ar") return `اكتمل ${completed}/${requested}، وتم خصم ${charged}`;
  const unit = charged === 1 ? "credit" : "credits";
  return `Completed ${completed}/${requested}, charged ${charged} ${unit}`;
}

/**
 * Partial packs must say what was charged, what was refunded, and what was
 * never debited. A refund count alone hides shots that had not started.
 */
export function formatPackCreditSummary(input: PackCreditCounts): string {
  const locale = resolveLocale(input.locale);
  const view = viewOf(input);
  const failure = joinFailure(locale, view);
  const head = headLine(locale, view);
  if (!failure) return head;
  const separator = locale === "zh" || locale === "ja" ? "。" : ". ";
  return `${head}${separator}${failure}`;
}

export function formatPackCreditSummaryFromPayload(
  data: {
    requested?: unknown;
    completed?: unknown;
    creditsCharged?: unknown;
    creditsRefunded?: unknown;
    creditsNotCharged?: unknown;
    failed?: unknown;
  },
  fallback: { requested: number; completed?: number },
  locale?: string,
): string {
  const failed = Array.isArray(data.failed)
    ? data.failed as Array<{ charged?: boolean; creditsRefunded?: boolean }>
    : [];
  const notCharged = typeof data.creditsNotCharged === "number"
    ? data.creditsNotCharged
    : failed.filter((shot) => shot?.charged === false).length;
  const unrefunded = failed.filter((shot) => shot?.charged === true && shot?.creditsRefunded !== true).length;
  return formatPackCreditSummary({
    completed: typeof data.completed === "number" ? data.completed : (fallback.completed ?? 0),
    requested: typeof data.requested === "number" ? data.requested : fallback.requested,
    creditsCharged: typeof data.creditsCharged === "number" ? data.creditsCharged : 0,
    creditsRefunded: typeof data.creditsRefunded === "number" ? data.creditsRefunded : 0,
    notCharged,
    unrefunded,
    locale,
  });
}
