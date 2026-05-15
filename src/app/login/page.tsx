import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex" style={{ background: "var(--bg)" }}>
      {/* Brand panel — left side */}
      <div
        className="hidden sm:flex flex-col justify-center flex-1 p-12 lg:p-16"
        style={{ background: "linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)" }}
      >
        <div className="max-w-md">
          {/* Logo */}
          <div
            className="flex items-center justify-center rounded-2xl mb-8"
            style={{
              width: 56,
              height: 56,
              background: "rgba(255,255,255,0.15)",
              color: "#fff",
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            闪
          </div>

          <h1 className="text-white mb-4" style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.02em" }}>
            闪象
          </h1>
          <p className="text-white/80 mb-10" style={{ fontSize: 18, lineHeight: 1.6 }}>
            一键闪象，万象更新
          </p>

          {/* Feature highlights */}
          <div className="flex flex-col gap-4">
            {[
              "AI 智能生成电商短视频",
              "一键发布到抖音、快手",
              "团队协作审核流程",
            ].map((text) => (
              <div key={text} className="flex items-center gap-3 text-white/90" style={{ fontSize: 14 }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Login form — right side */}
      <div className="flex items-center justify-center flex-1 p-8">
        <div className="w-full max-w-sm">
          {/* Mobile-only brand header */}
          <div className="sm:hidden text-center mb-8">
            <div
              className="inline-flex items-center justify-center rounded-xl mb-4 mx-auto"
              style={{
                width: 48,
                height: 48,
                background: "var(--accent)",
                color: "#fff",
                fontSize: 22,
                fontWeight: 700,
              }}
            >
              闪
            </div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>闪象</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>一键闪象，万象更新</p>
          </div>

          <div
            className="p-6 sm:p-8 rounded-xl shadow-sm"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <h2 className="text-lg font-semibold mb-5" style={{ color: "var(--text-primary)" }}>登录</h2>
            <LoginForm />
          </div>

          <p className="text-center text-xs mt-6" style={{ color: "var(--text-secondary)" }}>
            闪象 AI 视频工厂 v0.1.0
          </p>
        </div>
      </div>
    </main>
  );
}
