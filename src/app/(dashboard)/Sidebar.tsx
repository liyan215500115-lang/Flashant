"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Sparkles,
  Plug,
  FolderOpen,
  Settings,
  Plus,
  LogOut,
  Package,
  CreditCard,
  ChevronUp,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/landing/logo";
import { useT } from "@/components/i18n-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user as { name?: string; role?: string; image?: string | null } | undefined;
  const { t } = useT();

  const navGroups = [
    {
      label: t("sidebar.production"),
      items: [
        { href: "/dashboard", label: t("sidebar.dashboard"), icon: LayoutDashboard },
        { href: "/studio", label: t("sidebar.studio"), icon: Sparkles },
        { href: "/products", label: t("sidebar.products"), icon: Package },
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
    <aside className="flex flex-col h-screen flex-shrink-0 w-[232px] bg-gradient-to-b from-white to-zinc-50/50 dark:from-zinc-900 dark:to-zinc-900/80 border-r border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
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
            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
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
                      ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                      : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800"
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

      {/* Utility bar */}
      <div className="px-3 pb-2">
        <ThemeToggle />
      </div>

      {/* User footer */}
      <div className="border-t border-zinc-200/80 dark:border-zinc-700/80">
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full flex items-center gap-2.5 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors rounded-none">
            <Avatar className="w-7 h-7">
              {user?.image ? (
                <AvatarImage src={user.image} alt={user?.name || ""} />
              ) : null}
              <AvatarFallback className="text-xs bg-brand-900 text-white dark:bg-brand-700">
                {user?.name?.charAt(0)?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-xs font-medium truncate text-zinc-700 dark:text-zinc-300">
                {user?.name || "User"}
              </div>
              <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
                {user?.role === "admin" ? t("sidebar.admin") : t("sidebar.operator")}
              </div>
            </div>
            <ChevronUp size={12} className="text-zinc-400 shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" sideOffset={8}>
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              <Settings size={14} />
              {t("sidebar.settings")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/settings/billing")}>
              <CreditCard size={14} />
              {t("settings.billing")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
              <LogOut size={14} />
              {t("sidebar.signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
