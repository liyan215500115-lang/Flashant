import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { OnboardingProvider } from "@/components/onboarding/onboarding-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <OnboardingProvider>
      <TooltipProvider>
        <div className="flex h-screen overflow-hidden">
          <Suspense fallback={<aside className="w-[232px] flex-shrink-0 border-r border-zinc-200 dark:border-zinc-700/60" />}>
            <Sidebar />
          </Suspense>
          <main className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-900">
            {children}
          </main>
          <Toaster position="bottom-right" richColors />
        </div>
      </TooltipProvider>
    </OnboardingProvider>
  );
}
