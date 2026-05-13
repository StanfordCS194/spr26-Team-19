"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { NavBar } from "@/components/nav-bar";

const NAV_HIDDEN_PATHS = new Set<string>(["/"]);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";

  const showNav = useMemo(() => {
    // Hide on login/register landing.
    if (NAV_HIDDEN_PATHS.has(pathname)) return false;
    // If user isn’t logged in, still allow nav for public learning pages.
    return true;
  }, [pathname]);

  return (
    <>
      {showNav ? <NavBar /> : null}
      {children}
    </>
  );
}

