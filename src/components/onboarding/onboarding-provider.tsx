"use client";

import { useEffect, useState } from "react";
import { OnboardingModal } from "./onboarding-modal";

const STORAGE_KEY = "flashant_onboarding_seen";

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) {
      // Small delay so the dashboard renders first
      const timer = setTimeout(() => setShow(true), 600);
      return () => clearTimeout(timer);
    }
  }, []);

  function handleClose() {
    setShow(false);
    localStorage.setItem(STORAGE_KEY, "true");
  }

  return (
    <>
      {children}
      <OnboardingModal open={show} onClose={handleClose} />
    </>
  );
}
