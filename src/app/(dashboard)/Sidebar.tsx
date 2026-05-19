"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Sparkles,
  Plug,
  FolderOpen,
  Settings,
  Plus,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/landing/logo";
import { useT } from "@/components/i18n-provider";

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user as { name?: string; role?: string } | undefined;
  const { t } = useT();

  const navGroups = [
    {
      label: t("sidebar.production"),
      items: [
        { href: "/dashboard", label: t("sidebar.dashboard"), icon: LayoutDashboard },
        { href: "/studio", label: t("sidebar.studio"), icon: Sparkles },
      ],
    },
    {
      label: t("sidebar.assets"),
      items: [
        { href: "/integrations", label: t("sidebar.integrations"), icon: Plug },
        { href: "/assets", label: t("sidebar.assetsCenter"), icon: FolderOpen },
      ],
    },
    {
      label: t("sidebar.management"),
      items: [{ href: "/settings", label: t("sidebar.settings"), icon: Settings }],
    },
  ];

  return (
    <aside className="flex flex-col h-screen flex-shrink-0 w-[232px] bg-white border-r border-zinc-200/80">
      {/* Brand */}
      <div className="px-4 pt-5 pb-4">
        <Link href="/" className="inline-block">
          <Logo size={26} showTagline tagline={t("sidebar.tagline")} />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="px-3 flex flex-col gap-0.5 flex-1 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-3">
            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              {group.label}
            </div>
            {group.items.map((item) => {
              const active =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "bg-brand-50 text-brand-700"
                      : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50"
                  }`}
                >
                  <Icon size={16} strokeWidth={1.5} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}

        <div className="mt-2">
          <Link href="/products/new">
            <Button
              className="w-full justify-start gap-2 bg-brand-900 hover:bg-brand-800 text-white cursor-pointer shadow-sm"
              size="sm"
            >
              <Plus size={15} strokeWidth={2} />
              {t("sidebar.newProject")}
            </Button>
          </Link>
        </div>
      </nav>

      {/* User footer */}
      <div className="p-3 border-t border-zinc-200/80">
        <div className="flex items-center gap-2.5 mb-2 px-1">
          <div className="flex items-center justify-center rounded-full flex-shrink-0 text-xs font-semibold w-7 h-7 bg-brand-50 text-brand-700">
            {user?.name?.charAt(0) || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate text-zinc-700">
              {user?.name || "User"}
            </div>
            <div className="text-[10px] text-zinc-400">
              {user?.role === "admin" ? t("sidebar.admin") : t("sidebar.operator")}
            </div>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left rounded-lg transition-colors hover:bg-zinc-50 text-zinc-500 cursor-pointer"
        >
          <LogOut size={13} strokeWidth={1.5} />
          {t("sidebar.signOut")}
        </button>
      </div>
    </aside>
  );
}
