import { cookies } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ArrowDown, ArrowRight } from "lucide-react";
import { Logo } from "@/components/landing/logo";
import { LogoMark } from "@/components/landing/logo-mark";
import { Navbar } from "@/components/landing/navbar";
import { TrustCloud } from "@/components/landing/trust-cloud";
import { StyleShowcase } from "@/components/landing/style-showcase";
import { BeforeAfterSlider } from "@/components/landing/before-after-slider";
import { WorkflowSteps } from "@/components/landing/workflow-steps";
import { RoiTable } from "@/components/landing/roi-table";
import { BottomCta } from "@/components/landing/bottom-cta";
import { PricingCards } from "@/components/landing/pricing-cards";
import zh from "../../messages/zh.json";
import en from "../../messages/en.json";

export default async function LandingPage() {
  const session = await auth();
  const user = session?.user ?? null;

  const cookieStore = await cookies();
  const locale = cookieStore.get("NEXT_LOCALE")?.value === "zh" ? "zh" : "en";
  const messages = locale === "zh" ? zh : en;
  const t = (key: string): string => {
    let val: unknown = messages;
    for (const k of key.split(".")) {
      if (val && typeof val === "object") val = (val as Record<string, unknown>)[k];
      else return "";
    }
    return typeof val === "string" ? val : "";
  };

  let subscription = null;
  if (user?.id) {
    subscription = await db.subscription.findUnique({
      where: { userId: user.id as string },
      select: { planTier: true, status: true },
    });
  }

  // ── Mock style showcase data ──
  const styleData = [
    {
      key: "cosmetics",
      label: t("landing.styleShowcase.tabs.cosmetics"),
      tooltip: t("landing.styleShowcase.tooltips.cosmetics"),
      images: [
        "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&h=450&fit=crop&q=85",
        "https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=600&h=450&fit=crop&q=85",
        "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&h=450&fit=crop&q=85",
        "https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=600&h=450&fit=crop&q=85",
      ],
    },
    {
      key: "luxury",
      label: t("landing.styleShowcase.tabs.luxury"),
      tooltip: t("landing.styleShowcase.tooltips.luxury"),
      images: [
        "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600&h=450&fit=crop&q=85",
        "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=450&fit=crop&q=85",
        "https://images.unsplash.com/photo-1560343090-f0409e92791a?w=600&h=450&fit=crop&q=85",
        "https://images.unsplash.com/photo-1603561596112-0a132b757442?w=600&h=450&fit=crop&q=85",
      ],
    },
    {
      key: "cyber",
      label: t("landing.styleShowcase.tabs.cyber"),
      tooltip: t("landing.styleShowcase.tooltips.cyber"),
      images: [
        "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&h=450&fit=crop&q=85",
        "https://images.unsplash.com/photo-1517077304055-6e89abbf09b0?w=600&h=450&fit=crop&q=85",
        "https://images.unsplash.com/photo-1549490349-8643362247b5?w=600&h=450&fit=crop&q=85",
        "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&h=450&fit=crop&q=85",
      ],
    },
    {
      key: "whiteBg",
      label: t("landing.styleShowcase.tabs.whiteBg"),
      tooltip: t("landing.styleShowcase.tooltips.whiteBg"),
      images: [
        "https://images.unsplash.com/photo-1560343090-f0409e92791a?w=600&h=450&fit=crop&q=85",
        "https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=600&h=450&fit=crop&q=85",
        "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=600&h=450&fit=crop&q=85",
        "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&h=450&fit=crop&q=85",
      ],
    },
  ];

  return (
    <div className="bg-white relative">
      {/* Global grid background */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.015]"
        style={{
          backgroundImage:
            "linear-gradient(#1E3A8A 1px, transparent 1px), linear-gradient(90deg, #1E3A8A 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      <Navbar
        user={user}
        subscription={subscription}
        locale={locale}
        navLabels={{
          features: t("landing.nav.features"),
          styles: t("landing.nav.styles"),
          pricing: t("landing.nav.pricing"),
          signIn: t("landing.nav.signIn"),
          startFree: t("landing.nav.startFree"),
          workspace: t("nav.workspace"),
          settings: t("settings.title"),
          signOut: t("nav.signOut"),
          currentPlan: t("billing.currentTier"),
        }}
      />

      {/* ═══════════ Section 1: Hero ═══════════ */}
      <section className="relative flex flex-col lg:flex-row items-center justify-center text-center lg:text-left px-6 pt-28 pb-20 md:pt-36 md:pb-28 max-w-6xl mx-auto gap-12 lg:gap-16">
        {/* Left: copy */}
        <div className="flex-1 max-w-xl">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-brand-900 tracking-tight leading-[1.05]">
            {t("landing.hero.headline")}
            <br />
            <span className="bg-gradient-to-r from-holo-500 to-brand-700 bg-clip-text text-transparent">
              {t("landing.hero.headlineHighlight")}
            </span>
          </h1>

          <p className="mt-6 text-base md:text-lg text-zinc-500 leading-relaxed max-w-lg">
            {t("landing.hero.subheadline")}
          </p>

          <div className="mt-8">
            <Link
              href={user ? "/products/new" : "/register"}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-900 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-800 transition-all duration-200 active:scale-[0.98] shadow-lg shadow-brand-900/20 hover:shadow-xl hover:shadow-brand-900/25"
            >
              {t("landing.hero.cta")}
              <ArrowRight size={15} />
            </Link>
            <p className="mt-2.5 text-xs text-zinc-400">{t("landing.hero.ctaSub")}</p>
          </div>
        </div>

        {/* Right: product transformation preview */}
        <div className="flex-1 max-w-lg w-full">
          <div className="grid grid-cols-2 gap-3">
            {/* Before — raw product photo */}
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden group/card">
              <div className="aspect-[3/4] relative">
                <img
                  src="https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&h=533&fit=crop&q=85"
                  alt="Raw product photo"
                  className="absolute inset-0 w-full h-full object-cover grayscale-[15%] brightness-90 saturate-50"
                />
                <div className="absolute inset-0 bg-zinc-900/5" />
                {/* Label */}
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                  <span className="inline-block rounded-lg bg-zinc-800/70 backdrop-blur-sm px-2.5 py-1 text-[10px] font-semibold text-white uppercase tracking-wider shadow-sm">
                    Before
                  </span>
                  <span className="w-5 h-5 rounded-full bg-white/60 backdrop-blur-sm flex items-center justify-center">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#71717A" strokeWidth="2.5" strokeLinecap="round">
                      <rect x="3" y="3" width="18" height="18" rx="3" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path d="M21 15l-5-5L5 21" />
                    </svg>
                  </span>
                </div>
                {/* Bottom gradient label */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-white via-white/80 to-transparent pt-6 pb-2.5 px-3">
                  <p className="text-[11px] text-zinc-500 font-medium">Raw phone photo</p>
                </div>
              </div>
            </div>

            {/* After — AI-generated advertising visual */}
            <div className="rounded-2xl border-2 border-brand-200 bg-white shadow-lg shadow-brand-900/10 overflow-hidden relative group/card">
              {/* Glow spot */}
              <div className="absolute -top-10 -right-10 w-28 h-28 bg-holo-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="aspect-[3/4] relative">
                <img
                  src="https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=400&h=533&fit=crop&q=90"
                  alt="AI transformed product advertisement"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                {/* Sheen overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.06] via-transparent to-holo-500/[0.06] pointer-events-none" />
                {/* Label row */}
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-900/80 backdrop-blur-sm px-2.5 py-1 text-[10px] font-semibold text-white uppercase tracking-wider shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-holo-500 animate-pulse" />
                    After
                  </span>
                  <LogoMark size={18} />
                </div>
                {/* Bottom gradient label */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-white via-white/85 to-transparent pt-6 pb-2.5 px-3">
                  <p className="text-[11px] text-brand-700 font-semibold">AI studio-quality</p>
                </div>
              </div>
              {/* Bottom accent glow */}
              <div className="absolute inset-x-3 bottom-3 h-px rounded-full bg-gradient-to-r from-transparent via-holo-500/40 to-transparent" />
            </div>
          </div>

          {/* Caption */}
          <p className="mt-4 text-center text-xs text-zinc-400">
            From smartphone snap to studio-quality ad. Same product, transformed in seconds.
          </p>
        </div>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
          <ArrowDown size={16} className="text-zinc-300 animate-bounce" />
        </div>
      </section>

      {/* ═══════════ Section 2: Trust Cloud ═══════════ */}
      <TrustCloud
        title={t("landing.trustCloud.title")}
        subtitle={t("landing.trustCloud.subtitle")}
      />

      {/* ═══════════ Section 3: Style Showcase ═══════════ */}
      <div id="styles" className="scroll-mt-20" />
      <StyleShowcase
        title={t("landing.styleShowcase.title")}
        subtitle={t("landing.styleShowcase.subtitle")}
        styles={styleData}
      />

      {/* ═══════════ Section 4: Before & After ═══════════ */}
      <section className="py-24 md:py-32 px-6 bg-brand-950 text-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              {t("landing.beforeAfter.title")}
            </h2>
            <p className="mt-3 text-sm text-zinc-400 max-w-md mx-auto">
              {t("landing.beforeAfter.desc")}
            </p>
          </div>

          <BeforeAfterSlider
            beforeSrc="https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=1200&h=750&fit=crop&q=85"
            afterSrc="https://images.unsplash.com/photo-1556228720-195a672e8a03?w=1200&h=750&fit=crop&q=85"
            beforeLabel={t("landing.beforeAfter.beforeLabel")}
            afterLabel={t("landing.beforeAfter.afterLabel")}
          />
        </div>
      </section>

      {/* ═══════════ Section 5: Workflow ═══════════ */}
      <div id="features" className="scroll-mt-20" />
      <WorkflowSteps
        title={t("landing.workflow.title")}
        subtitle={t("landing.workflow.subtitle")}
        steps={[
          { title: t("landing.workflow.step1.title"), desc: t("landing.workflow.step1.desc") },
          { title: t("landing.workflow.step2.title"), desc: t("landing.workflow.step2.desc") },
          { title: t("landing.workflow.step3.title"), desc: t("landing.workflow.step3.desc") },
        ]}
      />

      {/* ═══════════ Section 6: ROI Table ═══════════ */}
      <RoiTable
        title={t("landing.roi.title")}
        subtitle={t("landing.roi.subtitle")}
        col1={t("landing.roi.col1")}
        col2={t("landing.roi.col2")}
        rows={[
          { label: t("landing.roi.rows.cost.label"), old: t("landing.roi.rows.cost.old"), new: t("landing.roi.rows.cost.new") },
          { label: t("landing.roi.rows.speed.label"), old: t("landing.roi.rows.speed.old"), new: t("landing.roi.rows.speed.new") },
          { label: t("landing.roi.rows.revision.label"), old: t("landing.roi.rows.revision.old"), new: t("landing.roi.rows.revision.new") },
          { label: t("landing.roi.rows.compliance.label"), old: t("landing.roi.rows.compliance.old"), new: t("landing.roi.rows.compliance.new") },
        ]}
        winner={t("landing.roi.winner")}
      />

      {/* ═══════════ Section 7: Pricing ═══════════ */}
      <section id="pricing" className="scroll-mt-20 py-24 md:py-32 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-2xl md:text-3xl font-bold text-brand-900 tracking-tight">
              {t("landing.pricing.title")}
            </h2>
            <p className="mt-3 text-sm text-zinc-500 max-w-md mx-auto">
              {t("landing.pricing.desc")}
            </p>
            {subscription && (
              <p className="mt-2 text-xs text-zinc-400">
                {t("landing.pricing.currentPlanPrefix")}
                <span className="font-medium text-zinc-600">
                  {subscription.planTier === "FREE"
                    ? t("landing.pricing.freePlan")
                    : subscription.planTier}
                </span>
                {t("landing.pricing.currentPlanSuffix")}
              </p>
            )}
          </div>

          <PricingCards
            currentPlan={subscription?.planTier ?? undefined}
            userLoggedIn={!!user}
            popularLabel={t("landing.pricing.popular")}
            currentPlanLabel={t("landing.pricing.currentPlan")}
            getStartedLabel={t("landing.pricing.getStarted")}
            learnMoreLabel={t("landing.pricing.learnMore")}
            goToWorkspaceLabel={t("landing.pricing.goToWorkspace")}
            plans={[
              {
                tier: "FREE" as const,
                name: t("landing.pricing.plans.free.name"),
                price: "$0",
                period: "/mo",
                desc: t("landing.pricing.plans.free.desc"),
                features: [
                  t("landing.pricing.plans.free.feature1"),
                  t("landing.pricing.plans.free.feature2"),
                  t("landing.pricing.plans.free.feature3"),
                  t("landing.pricing.plans.free.feature4"),
                ],
                highlighted: false,
              },
              {
                tier: "PRO" as const,
                name: t("landing.pricing.plans.pro.name"),
                price: "$19",
                period: "/mo",
                desc: t("landing.pricing.plans.pro.desc"),
                features: [
                  t("landing.pricing.plans.pro.feature1"),
                  t("landing.pricing.plans.pro.feature2"),
                  t("landing.pricing.plans.pro.feature3"),
                  t("landing.pricing.plans.pro.feature4"),
                  t("landing.pricing.plans.pro.feature5"),
                ],
                highlighted: true,
              },
              {
                tier: "BUSINESS" as const,
                name: t("landing.pricing.plans.business.name"),
                price: "$49",
                period: "/mo",
                desc: t("landing.pricing.plans.business.desc"),
                features: [
                  t("landing.pricing.plans.business.feature1"),
                  t("landing.pricing.plans.business.feature2"),
                  t("landing.pricing.plans.business.feature3"),
                  t("landing.pricing.plans.business.feature4"),
                  t("landing.pricing.plans.business.feature5"),
                  t("landing.pricing.plans.business.feature6"),
                ],
                highlighted: false,
              },
            ]}
          />
        </div>
      </section>

      {/* ═══════════ Section 8: Bottom CTA ═══════════ */}
      <BottomCta
        title={t("landing.bottomCta.title")}
        subtitle={t("landing.bottomCta.subtitle")}
        cta={t("landing.bottomCta.cta")}
        ctaSub={t("landing.bottomCta.ctaSub")}
        userLoggedIn={!!user}
      />

      {/* ═══════════ Footer ═══════════ */}
      <footer className="py-10 px-6 border-t border-zinc-100">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo size={22} />
          <p className="text-xs text-zinc-400">
            {t("landing.footer.copyright")}
          </p>
        </div>
      </footer>
    </div>
  );
}
