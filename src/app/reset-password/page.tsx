import Link from "next/link";
import { ResetPasswordForm } from "./ResetPasswordForm";
import { Logo } from "@/components/landing/logo";
import { getTranslator } from "@/lib/locale.server";

export default async function ResetPasswordPage() {
  const { t } = await getTranslator();

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-zinc-50">
      <div className="w-full max-w-[368px]">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex flex-col items-center gap-3">
            <Logo size={40} />
            <p className="text-xs text-zinc-400">{t("auth.brandSlogan")}</p>
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200/60 p-8">
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-zinc-900">
              {t("auth.resetTitle")}
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              {t("auth.resetDesc")}
            </p>
          </div>

          <ResetPasswordForm />

          <div className="mt-5 pt-5 border-t border-zinc-100 text-center">
            <Link
              href="/login"
              className="text-xs text-brand-700 hover:text-brand-900 font-medium transition-colors"
            >
              {t("auth.backToLogin")}
            </Link>
          </div>
        </div>

        <p className="text-center text-[11px] text-zinc-400 mt-6">
          {t("auth.brandSlogan")}
        </p>
      </div>
    </div>
  );
}
