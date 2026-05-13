 "use client";
 
 import Link from "next/link";
 import { usePathname } from "next/navigation";
 
 type NavItem = {
   href: string;
   label: string;
   /** Use when a section spans multiple routes (e.g. /numpy/*). */
   matchPrefix?: string;
 };
 
 const NAV: NavItem[] = [
   { href: "/dashboard", label: "Dashboard" },
   { href: "/find-my-level", label: "Placement" },
   { href: "/numpy/path", label: "Path", matchPrefix: "/numpy" },
   { href: "/numpy/exercises", label: "Exercises", matchPrefix: "/numpy/exercises" },
   { href: "/start-from-scratch", label: "From scratch", matchPrefix: "/start-from-scratch" },
 ];
 
 function isActive(pathname: string, item: NavItem): boolean {
   if (item.matchPrefix) return pathname === item.matchPrefix || pathname.startsWith(`${item.matchPrefix}/`);
   if (item.href === "/") return pathname === "/";
   return pathname === item.href;
 }
 
 export function NavBar() {
   const pathname = usePathname() ?? "/";
   const brandHref = "/dashboard";
 
   return (
     <header className="sticky top-0 z-50">
       <div className="mx-auto max-w-6xl px-4 pt-4 md:px-8">
         <div className="rounded-2xl border border-white/70 bg-white/60 shadow-sm backdrop-blur">
           <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
             <Link
               href={brandHref}
               className="font-black tracking-tight text-slate-900 hover:opacity-90"
             >
               AdaptED
             </Link>
 
             <nav className="flex flex-wrap items-center gap-1.5">
               {NAV.map((item) => {
                 const active = isActive(pathname, item);
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
