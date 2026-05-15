import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const role = (session.user as { role?: string }).role || "operator";

  return (
    <div className="max-w-[640px] mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">设置</h1>
        <p className="text-sm text-muted-foreground mt-1">账号信息和系统配置</p>
      </div>

      <div className="flex flex-col gap-5">
        {/* Account Info */}
        <Card>
          <CardHeader>
            <CardTitle>账号信息</CardTitle>
            <CardDescription>当前登录账号的基本信息</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">用户名</span>
              <span className="text-sm font-medium">{session.user.name || "-"}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">角色</span>
              <Badge variant="default">
                {role === "admin" ? "管理员" : "操作员"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* AI Services */}
        <Card>
          <CardHeader>
            <CardTitle>AI 服务配置</CardTitle>
            <CardDescription>配置 API 密钥以启用 AI 功能</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {[
                { name: "Claude（脚本生成）", key: "CLAUDE_API_KEY" },
                { name: "即梦（图片生成）", key: "JIMENG_API_KEY" },
                { name: "可灵（图片/视频）", key: "KLING_API_KEY" },
                { name: "火山引擎（TTS）", key: "TTS_API_KEY" },
              ].map((svc) => {
                const configured = !!process.env[svc.key];
                return (
                  <div key={svc.key} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <span className="text-sm">{svc.name}</span>
                    <span className="flex items-center gap-2">
                      <span
                        className={`inline-flex h-2 w-2 rounded-full ${configured ? "bg-emerald-500" : "bg-muted-foreground/30"}`}
                      />
                      <span className="text-xs text-muted-foreground">
                        {configured ? "已配置" : "未配置"}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              在 .env 文件中设置后重启服务生效
            </p>
          </CardContent>
        </Card>

        {/* Platform Accounts */}
        <Card>
          <CardHeader>
            <CardTitle>平台账号</CardTitle>
            <CardDescription>绑定发布平台以发布视频到抖音和快手</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {[
                { icon: "🎵", name: "抖音", key: "douyin" },
                { icon: "📱", name: "快手", key: "kuaishou" },
              ].map((platform) => (
                <div key={platform.key} className="flex items-center justify-between py-2">
                  <span className="text-sm">{platform.icon} {platform.name}</span>
                  <span className="text-xs text-muted-foreground">未绑定</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
