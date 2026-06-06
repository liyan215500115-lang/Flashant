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
          <Sidebar />
          <main className="flex-1 overflow-y-auto bg-gradient-to-br from-zinc-50/80 via-white to-zinc-50/40 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-900/90">
            {children}
          </main>
          <Toaster position="bottom-right" richColors />
        </div>
      </TooltipProvider>
    </OnboardingProvider>
  );
}
