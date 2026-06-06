import Link from "next/link";
import { cookies } from "next/headers";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { Logo } from "@/components/landing/logo";
import zh from "../../../messages/zh.json";
import en from "../../../messages/en.json";

function resolve(path: string, messages: Record<string, unknown>): string {
  const keys = path.split(".");
  let val: unknown = messages;
  for (const k of keys) {
    if (val && typeof val === "object" && k in (val as Record<string, unknown>)) {
      val = (val as Record<string, unknown>)[k];
    } else {
      return path;
    }
  }
  return typeof val === "string" ? val : path;
}

async function getT() {
  const cookieStore = await cookies();
  const locale = cookieStore.get("NEXT_LOCALE")?.value === "zh" ? "zh" : "en";
  const messages = locale === "zh" ? zh : en;
  return (key: string) => resolve(key, messages as unknown as Record<string, unknown>);
}

export default async function ForgotPasswordPage() {
  const t = await getT();

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
              {t("auth.forgotTitle")}
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              {t("auth.forgotDesc")}
            </p>
          </div>

          <ForgotPasswordForm />

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
