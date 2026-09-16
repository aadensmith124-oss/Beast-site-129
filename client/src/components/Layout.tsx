import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  BookOpen,
  CircleDot,
  CreditCard,
  Gift,
  Layers,
  LogOut,
  MessageSquare,
  Package,
  FileText,
  Send,
  Settings,
  Trophy,
  User,
  X,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  // Close on route change
  useEffect(() => {
    setNavOpen(false);
    setAccountOpen(false);
  }, [location]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = navOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [navOpen]);

  const balanceDollars = user ? (user.balance / 100).toFixed(2) : "0.00";

  const { data: features } = useQuery<{ checker: boolean; reseller: boolean; ranks: boolean; logs: boolean; cards: boolean }>({
    queryKey: ["/api/settings/features"],
    staleTime: 30000,
  });

  const { data: announcements } = useQuery<{ id: number; content: string; link: string | null; active: boolean; bannerColor?: string }[]>({
    queryKey: ["/api/announcements"],
    staleTime: 60000,
  });
  const activeAnnouncements = announcements?.filter(a => a.active) ?? [];

  type NavItem = {
    href: string;
    label: string;
    icon: React.ElementType;
    external?: boolean;
  };

  const navSections: { label: string; links: NavItem[] }[] = [
    {
      label: "Main",
      links: [
        { href: "/deposit", label: "Deposit Cash", icon: CreditCard },
        { href: "/redeem", label: "Redeem Code", icon: Gift },
        { href: "/orders", label: "Orders", icon: Package },
        ...(features?.ranks !== false ? [{ href: "/ranks", label: "Ranks", icon: Trophy }] : []),
      ],
    },
    {
      label: "Channel",
      links: [
        { href: "https://t.me/+3-lMkt-idutkOTIx", label: "Telegram Channel", icon: Send, external: true },
      ],
    },
    {
      label: "Support",
      links: [
        { href: "/support", label: "Tickets", icon: MessageSquare },
      ],
    },
    {
      label: "Featured",
      links: [
        ...(features?.logs !== false ? [{ href: "/shop", label: "Logs", icon: FileText }] : []),
        { href: "/", label: "Cards", icon: CreditCard },
        { href: "/games/plinko", label: "Plinko", icon: CircleDot },
        ...(features?.checker !== false ? [{ href: "/checker", label: "Checker", icon: Layers }] : []),
        ...(features?.reseller !== false ? [{ href: "/become-reseller", label: "Become Seller", icon: BookOpen }] : []),
      ],
    },
    ...((user?.role === "admin" || (user as any)?.isWorker) ? [{
      label: "Management",
      links: [
        ...(user?.role === "admin" ? [{ href: "/admin", label: "Admin", icon: Settings }] : []),
        ...((user as any)?.isWorker && user?.role !== "admin" ? [{ href: "/worker", label: "Worker", icon: Settings }] : []),
      ],
    }] : []),
  ];

  const isEntryPage = location === "/auth" || location === "/forgot-password";
  if (isEntryPage) return <>{children}</>;

  return (
    <div className="min-h-screen bg-background">

      {/* ── Announcement banner ── */}
      {activeAnnouncements.length > 0 && (
        <div
          className="w-full overflow-hidden z-50"
          style={{ height: 32, backgroundColor: activeAnnouncements[0].bannerColor ?? "#5a0000" }}
        >
          <div className="flex items-center h-full whitespace-nowrap animate-[marquee_18s_linear_infinite]">
            {[...Array(4)].flatMap((_, repeat) => activeAnnouncements.map((announcement) => (
              announcement.link ? (
                <a
                  key={`${repeat}-${announcement.id}`}
                  href={announcement.link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-bold tracking-widest text-white uppercase px-12 hover:text-white/80"
                >
                  {announcement.content}
                </a>
              ) : (
                <span key={`${repeat}-${announcement.id}`} className="text-[11px] font-bold tracking-widest text-white uppercase px-12">
                  {announcement.content}
                </span>
              )
            )))}
          </div>
        </div>
      )}

      {/* ── Top bar ── */}
      <header className="flex items-center justify-between px-4 h-[52px] border-b border-white/8 bg-background sticky top-0 z-30">
        {/* Hamburger */}
        <button
          onClick={() => { setNavOpen(o => !o); setAccountOpen(false); }}
          className="flex flex-col gap-[5px] p-1 shrink-0"
          data-testid="btn-menu"
          aria-label="Toggle navigation"
        >
          <span className="block w-5 h-[2px] bg-white/70 rounded transition-all" />
          <span className="block w-5 h-[2px] bg-white/70 rounded transition-all" />
          <span className="block w-5 h-[2px] bg-white/70 rounded transition-all" />
        </button>

        {/* Wordmark */}
        <span className="text-primary font-black tracking-[0.18em] uppercase text-sm select-none">
          TurtleCC
        </span>

        {/* Balance pill */}
        {user ? (
          <Link href="/deposit">
            <button className="text-xs font-mono font-bold text-primary border border-primary/30 bg-primary/10 px-3 py-1 rounded hover:bg-primary/15 transition-colors" data-testid="btn-balance">
              ${balanceDollars}
            </button>
          </Link>
        ) : <div className="w-14" />}
      </header>

      {/* ── Backdrop ── */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] transition-opacity duration-200 ${navOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={() => setNavOpen(false)}
      />

      {/* ── Side drawer ── */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-[#0a0a0a] border-r border-white/8 flex flex-col shadow-2xl transition-transform duration-200 ease-out ${navOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-4 h-[52px] border-b border-white/8 shrink-0">
          <span className="text-primary font-black tracking-[0.18em] uppercase text-xs">TurtleCC</span>
          <button onClick={() => setNavOpen(false)} className="text-white/40 hover:text-white/80 transition-colors p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Grouped nav links */}
        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {navSections.map(section => (
            <div key={section.label} className="mb-5 last:mb-0">
              <p className="px-3 mb-2 text-[10px] font-medium uppercase tracking-[0.22em] text-white/25">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.links.map(({ href, label, icon: Icon, external }) => {
                  const isActive = !external && (location === href || (href === "/" && location === "/"));
                  const itemClass = `flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium cursor-pointer transition-colors rounded-sm ${
                    isActive
                      ? "text-white bg-white/10"
                      : "text-white/55 hover:text-white/90 hover:bg-white/5"
                  }`;

                  if (external) {
                    return (
                      <a
                        key={href}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={itemClass}
                        onClick={() => setNavOpen(false)}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-white/45" strokeWidth={1.7} />
                        <span>{label}</span>
                      </a>
                    );
                  }

                  return (
                    <Link key={href} href={href}>
                      <div className={itemClass} onClick={() => setNavOpen(false)}>
                        <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : "text-white/45"}`} strokeWidth={1.7} />
                        <span>{label}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Account section at bottom */}
        {user && (
          <div className="border-t border-white/8 shrink-0">
            <Link href="/profile">
              <div className="flex items-center gap-2.5 px-4 py-3 text-sm text-white/60 hover:text-white hover:bg-white/4 transition-colors cursor-pointer">
                <User className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate text-xs">{user.username}</span>
                <span className="ml-auto text-xs font-mono text-primary">${balanceDollars}</span>
              </div>
            </Link>
            <button
              onClick={() => { logout(); setNavOpen(false); }}
              className="flex items-center gap-2.5 w-full px-4 py-2.5 text-xs font-medium text-white/45 hover:text-white/80 hover:bg-white/5 transition-colors border-t border-white/5"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        )}
      </aside>

      {/* ── Page content ── */}
      <main className="min-h-[calc(100vh-52px)]">
        {children}
      </main>

    </div>
  );
}
