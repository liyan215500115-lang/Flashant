import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "./Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg)" }}>
      <Sidebar />
      <main
        className="flex-1 overflow-y-auto p-6"
        style={{ background: "var(--bg)" }}
      >
        {children}
      </main>
    </div>
  );
}
