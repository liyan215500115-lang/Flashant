"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <aside
      className="flex flex-col justify-between h-screen flex-shrink-0 border-r"
      style={{
        width: "var(--sidebar-width)",
        background: "var(--surface)",
        borderColor: "var(--border)",
      }}
    >
      <nav className="p-4 flex flex-col gap-1">
        <Link
          href="/projects"
          className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors"
          style={{
            background: isActive("/projects") ? "var(--accent)" : "transparent",
            color: isActive("/projects") ? "#fff" : "var(--text-primary)",
            borderRadius: "var(--radius-md)",
          }}
        >
          📱 项目列表
        </Link>
        <Link
          href="/projects/new"
          className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors"
          style={{
            background: isActive("/projects/new") ? "var(--accent)" : "transparent",
            color: isActive("/projects/new") ? "#fff" : "var(--text-primary)",
            borderRadius: "var(--radius-md)",
          }}
        >
          ➕ 新建项目
        </Link>
        <Link
          href="/settings"
          className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors"
          style={{
            background: isActive("/settings") ? "var(--accent)" : "transparent",
            color: isActive("/settings") ? "#fff" : "var(--text-primary)",
            borderRadius: "var(--radius-md)",
          }}
        >
          ⚙️ 设置
        </Link>
      </nav>
      <div className="p-4 border-t" style={{ borderColor: "var(--border)" }}>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full px-3 py-2 text-sm text-left rounded-md transition-colors"
          style={{
            color: "var(--text-secondary)",
            borderRadius: "var(--radius-md)",
          }}
        >
          退出登录
        </button>
      </div>
    </aside>
  );
}
