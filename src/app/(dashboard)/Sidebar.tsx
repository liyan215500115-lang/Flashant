"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { LayoutDashboard, Clapperboard, Settings, Plus, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { href: "/", label: "工作台", icon: LayoutDashboard },
  { href: "/projects", label: "项目", icon: Clapperboard },
  { href: "/settings", label: "设置", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user as { name?: string; role?: string } | undefined;

  return (
    <aside
      className="flex flex-col h-screen flex-shrink-0 border-r"
      style={{
        width: "var(--sidebar-width)",
        background: "var(--surface)",
        borderColor: "var(--border)",
      }}
    >
      {/* Brand header */}
      <div className="px-4 pt-5 pb-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div
            className="flex items-center justify-center rounded-lg flex-shrink-0"
            style={{
              width: 28,
              height: 28,
              background: "var(--accent)",
              color: "#fff",
              fontSize: 15,
              fontWeight: 700,
            }}
          >
            闪
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">闪象</div>
            <div className="text-xs text-muted-foreground leading-tight">AI 视频工厂</div>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="px-3 flex flex-col gap-0.5 flex-1">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors"
              style={{
                background: active ? "var(--accent-subtle)" : "transparent",
                color: active ? "var(--accent)" : "var(--text-primary)",
              }}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {/* CTA button */}
        <div className="mt-3">
          <Link href="/projects/new">
            <Button variant="default" size="sm" className="w-full justify-start gap-2">
              <Plus size={16} />
              新建项目
            </Button>
          </Link>
        </div>
      </nav>

      {/* User footer */}
      <div className="p-3 border-t" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2.5 mb-2 px-1">
          <div
            className="flex items-center justify-center rounded-full flex-shrink-0 text-xs font-medium"
            style={{
              width: 24,
              height: 24,
              background: "var(--accent-subtle)",
              color: "var(--accent)",
            }}
          >
            {user?.name?.charAt(0) || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate">{user?.name || "用户"}</div>
            <div className="text-xs text-muted-foreground">
              {user?.role === "admin" ? "管理员" : "操作员"}
            </div>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left rounded-md transition-colors hover:bg-muted text-muted-foreground"
        >
          <LogOut size={14} />
          退出登录
        </button>
      </div>
    </aside>
  );
}
