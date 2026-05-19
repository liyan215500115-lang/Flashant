import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { I18nProvider } from "@/components/i18n-provider";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <I18nProvider>
      <div className="flex h-screen overflow-hidden bg-zinc-50">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </I18nProvider>
  );
}
