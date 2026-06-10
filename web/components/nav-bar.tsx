 "use client";
 
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import {
  getPlacementCompletedServerSnapshot,
  getPlacementCompletedSnapshot,
  subscribePlacementCompleted,
} from "@/lib/numpy-placement-storage";
import {
  getXPServerSnapshot,
  getXPSnapshot,
  getTierForXP,
  subscribeXP,
} from "@/lib/xp-store";
 
 type NavItem = {
   href: string;
   label: string;
   /** Use when a section spans multiple routes (e.g. /numpy/*). */
   matchPrefix?: string;
 };
 
 const NAV: NavItem[] = [
   { href: "/dashboard", label: "Dashboard" },
   { href: "/find-my-level", label: "Placement" },
  { href: "/numpy/path", label: "Path", matchPrefix: "/numpy/path" },
  { href: "/numpy/lessons", label: "Lessons", matchPrefix: "/numpy/lessons" },
  { href: "/numpy/exercises", label: "Exercises", matchPrefix: "/numpy/exercises" },
];
 
function isActive(pathname: string, item: NavItem, placementDone: boolean): boolean {
  // Placement test page has no tab of its own once taken, so light up Path instead.
  if (item.href === "/numpy/path" && placementDone && pathname === "/find-my-level") {
    return true;
  }
  if (item.matchPrefix) return pathname === item.matchPrefix || pathname.startsWith(`${item.matchPrefix}/`);
  if (item.href === "/") return pathname === "/";
  return pathname === item.href;
}
 
export function NavBar() {
  const pathname = usePathname() ?? "/";
  const brandHref = "/dashboard";

  const placementDone = useSyncExternalStore(
    subscribePlacementCompleted,
    getPlacementCompletedSnapshot,
    getPlacementCompletedServerSnapshot,
  );

  const xpRecord = useSyncExternalStore(subscribeXP, getXPSnapshot, getXPServerSnapshot);
  const tier = getTierForXP(xpRecord.total);

  // Once a user has taken placement, hide it from the nav (retake lives in profile).
  const items = NAV.filter((item) => item.href !== "/find-my-level" || !placementDone);

  return (
    <header className="sticky top-0 z-50">
      <div className="mx-auto max-w-6xl px-4 pt-4 md:px-8">
        <div className="rounded-2xl border border-white/70 bg-white/60 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
            <Link
              href={brandHref}
              className="flex items-center gap-2 font-black tracking-tight text-slate-900 hover:opacity-90"
            >
              AdaptED
              {xpRecord.total > 0 && (
                <span title={`${tier.name} · ${xpRecord.total} XP`} className="text-base leading-none">
                  {tier.icon}
                </span>
              )}
            </Link>

            <nav className="flex flex-wrap items-center gap-1.5">
              {items.map((item) => {
                 const active = isActive(pathname, item, placementDone);
                 return (
                   <Link
                     key={item.href}
                     href={item.href}
                     className={
                       active
                         ? "rounded-xl bg-gradient-to-r from-pink-500 to-sky-500 px-3 py-1.5 text-sm font-semibold text-white shadow-sm"
                         : "rounded-xl px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-white/70"
                     }
                   >
                     {item.label}
                   </Link>
                 );
               })}
             </nav>
           </div>
         </div>
       </div>
     </header>
   );
 }
