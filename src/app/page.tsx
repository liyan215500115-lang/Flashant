import { cookies } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ArrowDown, ArrowRight } from "lucide-react";
import { Logo } from "@/components/landing/logo";
import { LogoMark } from "@/components/landing/logo-mark";
import { Navbar } from "@/components/landing/navbar";
import { ScrollReveal } from "@/components/scroll-reveal";
import { HeroCards } from "@/components/landing/hero-cards";
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
        "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=600&h=450&fit=crop&q=85",
        "https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=600&h=450&fit=crop&q=85",
        "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&h=450&fit=crop&q=85",
        "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=600&h=450&fit=crop&q=85",
      ],
    },
    {
      key: "luxury",
      label: t("landing.styleShowcase.tabs.luxury"),
      tooltip: t("landing.styleShowcase.tooltips.luxury"),
      images: [
        "https://images.unsplash.com/photo-1618220178548-1b4e1c7c2b06?w=600&h=450&fit=crop&q=85",
        "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600&h=450&fit=crop&q=85",
        "https://images.unsplash.com/photo-1616486029423-aaa4789e8c9a?w=600&h=450&fit=crop&q=85",
        "https://images.unsplash.com/photo-1586105251261-72a756497a11?w=600&h=450&fit=crop&q=85",
      ],
    },
    {
      key: "cyber",
      label: t("landing.styleShowcase.tabs.cyber"),
      tooltip: t("landing.styleShowcase.tooltips.cyber"),
      images: [
        "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&h=450&fit=crop&q=85",
        "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&h=450&fit=crop&q=85",
        "https://images.unsplash.com/photo-1517077304055-6e89abbf09b0?w=600&h=450&fit=crop&q=85",
        "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=450&fit=crop&q=85",
      ],
    },
    {
      key: "whiteBg",
      label: t("landing.styleShowcase.tabs.whiteBg"),
      tooltip: t("landing.styleShowcase.tooltips.whiteBg"),
      images: [
        "https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=600&h=450&fit=crop&q=85",
        "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&h=450&fit=crop&q=85",
        "https://images.unsplash.com/photo-1546865611-2cb84010f5a5?w=600&h=450&fit=crop&q=85",
        "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=600&h=450&fit=crop&q=85",
      ],
    },
  ];

  return (
    <div className="bg-white relative">
      <div className="fixed inset-0 pointer-events-none opacity-[0.015]" style={{ backgroundImage: "linear-gradient(#1E3A8A 1px, transparent 1px), linear-gradient(90deg, #1E3A8A 1px, transparent 1px)", backgroundSize: "64px 64px" }} />
      <ScrollReveal />

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
      <section className="relative flex flex-col lg:flex-row items-center justify-center text-center lg:text-left px-6 pt-32 pb-24 md:pt-44 md:pb-36 max-w-6xl mx-auto gap-16 lg:gap-20">
        {/* Left: copy */}
        <div className="flex-1 max-w-xl">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-brand-900 tracking-tight leading-[1.05]">
            {t("landing.hero.headline")}
            <br />
            <span className="bg-gradient-to-r from-holo-500 to-brand-700 bg-clip-text text-transparent">
              {t("landing.hero.headlineHighlight")}
            </span>
          </h1>

          <p className="mt-6 text-base md:text-lg text-zinc-500 leading-relaxed max-w-lg animate-on-scroll">
            {t("landing.hero.subheadline")}
          </p>

          <div className="mt-8 animate-on-scroll">
            <Link
              href={user ? "/studio" : "/register"}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-900 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-800 transition-all duration-200 active:scale-[0.98] shadow-sm"
            >
              {t("landing.hero.cta")}
              <ArrowRight size={15} />
            </Link>
            <p className="mt-2.5 text-xs text-zinc-400">{t("landing.hero.ctaSub")}</p>
          </div>
        </div>

        {/* Right: product transformation preview */}
        <HeroCards />

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
      <section className="py-32 md:py-40 px-6 bg-zinc-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14 animate-on-scroll">
            <h2 className="text-2xl md:text-3xl font-bold text-brand-900 tracking-tight">
              {t("landing.beforeAfter.title")}
            </h2>
            <p className="mt-3 text-sm text-zinc-500 max-w-md mx-auto">
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
      <section id="pricing" className="scroll-mt-20 py-32 md:py-40 px-6 bg-zinc-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 animate-on-scroll">
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
