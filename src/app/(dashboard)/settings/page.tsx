import { auth } from "@/lib/auth";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const role = (session.user as { role?: string }).role || "operator";

  return (
    <div className="max-w-[640px] mx-auto">
      <div className="mb-8">
        <h1 style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.3 }}>设置</h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
          账号信息和系统配置
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <section
          className="p-6 rounded-lg border"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
            borderRadius: "var(--radius-lg)",
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>账号信息</h2>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
            当前登录账号的基本信息
          </p>
          <div className="flex flex-col gap-3">
            <div className="flex justify-between py-2 border-b" style={{ borderColor: "var(--border)" }}>
              <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>用户名</span>
              <span style={{ fontSize: 14, fontWeight: 500 }}>{session.user.name || "-"}</span>
            </div>
            <div className="flex justify-between py-2 border-b" style={{ borderColor: "var(--border)" }}>
              <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>角色</span>
              <span
                className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                {role === "admin" ? "管理员" : "操作员"}
              </span>
            </div>
          </div>
        </section>

        <section
          className="p-6 rounded-lg border"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
            borderRadius: "var(--radius-lg)",
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>AI 服务配置</h2>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
            配置 AI 服务 API 密钥以使用各项功能
          </p>
          <div className="flex flex-col gap-3">
            {[
              { name: "Claude (脚本生成)", key: "CLAUDE_API_KEY" },
              { name: "即梦 (图片生成)", key: "JIMENG_API_KEY" },
              { name: "可灵 (图片/视频)", key: "KLING_API_KEY" },
              { name: "火山引擎 (TTS)", key: "TTS_API_KEY" },
            ].map((svc) => (
              <div key={svc.key} className="flex items-center justify-between py-2 border-b" style={{ borderColor: "var(--border)" }}>
                <span style={{ fontSize: 14 }}>{svc.name}</span>
                <span
                  className="inline-flex w-2 h-2 rounded-full"
                  style={{ background: process.env[svc.key] ? "var(--success)" : "var(--text-secondary)" }}
                  title={process.env[svc.key] ? "已配置" : "未配置"}
                />
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 12 }}>
            在 .env 文件中配置 API 密钥后重启服务生效
          </p>
        </section>

        <section
          className="p-6 rounded-lg border"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
            borderRadius: "var(--radius-lg)",
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>平台账号</h2>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
            绑定发布平台账号以发布视频
          </p>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between py-2">
              <span style={{ fontSize: 14 }}>📱 抖音</span>
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>未绑定</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span style={{ fontSize: 14 }}>📱 快手</span>
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>未绑定</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
