import { ArrowRight, BellRing, ChevronLeft, FolderKanban, LayoutDashboard, LogOut, Menu, Settings2, Sparkles, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { getRoleLabel } from '../../lib/format';
import { cn } from '../../lib/cn';
import { useSessionStore } from '../../stores/session-store';
import { Button } from '../ui/Button';

export interface NavItem {
  to: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  end?: boolean;
}

interface DashboardShellProps {
  title: string;
  subtitle?: string;
  navItems?: NavItem[];
  utilityItems?: NavItem[];
  headerActions?: ReactNode;
  children: ReactNode;
}

const matchesNavItem = (pathname: string, item: NavItem) =>
  item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);

const adminPageMeta: Record<string, { description: string; tone: string }> = {
  '/admin': {
    description: 'پوختەی سیستەم، ئامار و کردارە خێراکان لە یەک شوێن.',
    tone: 'from-brand-50 via-white to-amber-50 text-stone-900 border-brand-100',
  },
  '/admin/orders': {
    description: 'هەموو سەفەری و گەیاندنەکان بە فلتەر، گەڕان و وردەکاری.',
    tone: 'from-brand-50 via-white to-sky-50 text-stone-900 border-brand-100',
  },
  '/admin/delivery-orders': {
    description: 'هەموو گەیاندنەکان لە یەک لیست و بەڕێوەبردنیان.',
    tone: 'from-sky-50 via-white to-cyan-50 text-stone-900 border-sky-100',
  },
  '/admin/all-foods': {
    description: 'پۆلەکان و خواردنەکان لە یەک پەیج، زیادکردن، دەستکاری و وێنەکان.',
    tone: 'from-amber-50 via-white to-orange-50 text-stone-900 border-amber-100',
  },
  '/admin/menu-images': {
    description: 'بینینی وێنە هەڵگیراوەکان و دۆخی پەیوەندییان لەگەڵ خواردنەکان.',
    tone: 'from-emerald-50 via-white to-teal-50 text-stone-900 border-emerald-100',
  },
  '/admin/notifications': {
    description: 'ئاگەدارکردنەوەکان، نوێ/نەخوێندراوەکان و وردەکاری.',
    tone: 'from-rose-50 via-white to-pink-50 text-stone-900 border-rose-100',
  },
  '/admin/reports': {
    description: 'ڕاپۆرت، ئامار، ڕەوتی ڕۆژانە و پوختەی فرۆشتن.',
    tone: 'from-violet-50 via-white to-fuchsia-50 text-stone-900 border-violet-100',
  },
  '/admin/employee-activity': {
    description: 'چاڵاکیی کارمەند، کاتژمێر و ئاماری سەفەری.',
    tone: 'from-indigo-50 via-white to-blue-50 text-stone-900 border-indigo-100',
  },
  '/admin/media': {
    description: 'پوختەی وێنەکان و دۆخی بەکارهێنانیان.',
    tone: 'from-cyan-50 via-white to-sky-50 text-stone-900 border-cyan-100',
  },
  '/admin/activity': {
    description: 'تۆماری چالاکییەکان و گۆڕانکارییەکان.',
    tone: 'from-stone-100 via-white to-stone-50 text-stone-900 border-stone-200',
  },
  '/admin/settings': {
    description: 'ڕێکخستن، پاراستن و کۆنترۆڵی بازرگانی.',
    tone: 'from-orange-50 via-white to-amber-50 text-stone-900 border-orange-100',
  },
};

const adminQuickAccessItems = [
  {
    to: '/admin',
    label: 'داشبۆرد',
    icon: LayoutDashboard,
    tone: 'border-stone-200 bg-white text-stone-800 hover:border-stone-300 hover:bg-stone-50',
  },
  {
    to: '/admin/all-foods',
    label: 'خواردنەکان',
    icon: FolderKanban,
    tone: 'border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300 hover:bg-amber-100',
  },
  {
    to: '/admin/reports',
    label: 'ڕاپۆرتەکان',
    icon: Sparkles,
    tone: 'border-brand-200 bg-brand-50 text-brand-800 hover:border-brand-300 hover:bg-brand-100',
  },
  {
    to: '/admin/notifications',
    label: 'ئاگەدارکردنەوە',
    icon: BellRing,
    tone: 'border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300 hover:bg-amber-100',
  },
  {
    to: '/admin/settings',
    label: 'ڕێکخستن',
    icon: Settings2,
    tone: 'border-stone-200 bg-stone-100 text-stone-700 hover:border-stone-300 hover:bg-stone-200',
  },
] as const;

export const DashboardShell = ({
  title,
  subtitle,
  navItems = [],
  utilityItems = [],
  headerActions,
  children,
}: DashboardShellProps) => {
  const session = useSessionStore((state) => state.session);
  const logout = useSessionStore((state) => state.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const isAdmin = session?.role === 'admin';
  const sessionRoleLabel = session ? (session.role === 'admin' ? 'ئادمێن' : getRoleLabel(session.role)) : '';
  const currentPage =
    [...navItems, ...utilityItems].find((item) => matchesNavItem(location.pathname, item)) ??
    null;
  const currentPageLabel = currentPage?.shortLabel ?? currentPage?.label ?? title;
  const CurrentPageIcon = currentPage?.icon ?? LayoutDashboard;
  const isAdminDashboard = location.pathname === '/admin';
  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  const handleAdminBack = () => {
    const hasSameOriginReferrer =
      typeof document !== 'undefined' &&
      document.referrer.length > 0 &&
      document.referrer.startsWith(window.location.origin);
    const historyIndex = typeof window !== 'undefined' ? (window.history.state?.idx as number | undefined) ?? 0 : 0;

    if (location.pathname === '/admin') {
      navigate('/admin');
      return;
    }

    if (hasSameOriginReferrer || historyIndex > 0) {
      navigate(-1);
      return;
    }

    navigate('/admin');
  };

  useEffect(() => {
    if (!adminMenuOpen) {
      return;
    }

    const closeMenuFrame = window.requestAnimationFrame(() => {
      setAdminMenuOpen(false);
    });

    return () => {
      window.cancelAnimationFrame(closeMenuFrame);
    };
  }, [adminMenuOpen, location.pathname]);

  useEffect(() => {
    if (!isAdmin || !adminMenuOpen) {
      document.body.style.removeProperty('overflow');
      return;
    }

    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAdminMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.removeProperty('overflow');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [adminMenuOpen, isAdmin]);

  if (!session) {
    return null;
  }

  if (isAdmin) {
    return (
      <div className="min-h-screen bg-sand bg-grain text-stone-900">
        <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[28rem] bg-gradient-to-b from-stone-950/10 via-brand-100/50 to-transparent" />
        <div className="pointer-events-none fixed right-[-8rem] top-[-5rem] -z-10 h-72 w-72 rounded-full bg-brand-200/30 blur-3xl" />
        <div className="pointer-events-none fixed left-[-7rem] top-32 -z-10 h-64 w-64 rounded-full bg-amber-200/25 blur-3xl" />
        <div className="pointer-events-none fixed bottom-[-8rem] left-1/2 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-200/20 blur-3xl" />

        <div
          className={cn(
            'fixed inset-0 z-40 bg-stone-950/35 backdrop-blur-[2px] transition duration-300',
            adminMenuOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
          onClick={() => setAdminMenuOpen(false)}
        />

        <aside
          className={cn(
            'fixed right-0 top-0 z-50 flex h-full w-[90vw] max-w-[32rem] flex-col border-l border-white/60 bg-white/95 shadow-[0_24px_60px_rgba(15,23,42,0.25)] backdrop-blur-xl transition duration-300 sm:max-w-[36rem] xl:w-[46vw] xl:max-w-[48rem]',
            adminMenuOpen ? 'translate-x-0' : 'translate-x-full',
          )}
          role="dialog"
          aria-modal="true"
          aria-hidden={!adminMenuOpen}
        >
          <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4 sm:px-6">
            <div className="space-y-1">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-stone-400">ناوەندی بەشەکان</p>
            </div>
            <button
              type="button"
              onClick={() => setAdminMenuOpen(false)}
              className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-700 transition hover:bg-stone-200"
              aria-label="داخستنی مینو"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
            <div className="rounded-[2rem] border border-stone-200 bg-gradient-to-br from-stone-950 via-stone-900 to-brand-900 p-5 text-white shadow-card">
              <div className="flex items-center gap-3 rounded-[1.6rem] bg-white/10 px-4 py-4 shadow-inner">
                <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] bg-white/10">
                  <LayoutDashboard className="h-5 w-5" />
                </div>
                <h3 className="truncate text-2xl font-black tracking-tight">
                  {sessionRoleLabel}: {session.displayName}
                </h3>
              </div>
            </div>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-[0.22em] text-stone-400">navigation</h3>
                <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600">
                  سەرەکی
                </span>
              </div>
              <div className="space-y-3">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setAdminMenuOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'group flex items-center justify-between gap-4 rounded-[1.8rem] border p-4 transition hover:-translate-y-0.5',
                        isActive
                          ? 'border-stone-900 bg-stone-950 text-white shadow-card'
                          : `bg-gradient-to-br ${adminPageMeta[item.to]?.tone ?? 'from-white to-stone-50 text-stone-900 border-stone-200'} shadow-sm`,
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <div className="flex min-w-0 items-center gap-4">
                          <div
                            className={cn(
                              'flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.4rem] shadow-inner',
                              isActive ? 'bg-white/10 text-white' : 'bg-white/85 text-stone-900',
                            )}
                          >
                            <item.icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <p className={cn('text-base font-black', isActive ? 'text-white' : 'text-stone-900')}>
                              {item.label}
                            </p>
                            {item.to !== '/admin' ? (
                              <p className={cn('mt-1 text-sm leading-6', isActive ? 'text-white/70' : 'text-stone-600')}>
                                {adminPageMeta[item.to]?.description ?? 'پەیجێکی تایبەت بۆ ئەم ناوەندە.'}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <ChevronLeft className={cn('h-5 w-5 shrink-0 transition', isActive ? 'text-white/70' : 'text-stone-400')} />
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </section>

            {utilityItems.length > 0 ? (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-[0.22em] text-stone-400">ئامرازەکان</h3>
                  <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                    تایبەت
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {utilityItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      onClick={() => setAdminMenuOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'rounded-[1.8rem] border p-4 transition hover:-translate-y-0.5',
                          isActive
                            ? 'border-brand-700 bg-brand-700 text-white shadow-card'
                            : `bg-gradient-to-br ${adminPageMeta[item.to]?.tone ?? 'from-white to-stone-50 text-stone-900 border-stone-200'} shadow-sm`,
                        )
                      }
                    >
                      {({ isActive }) => (
                        <div className="space-y-3">
                          <div
                            className={cn(
                              'inline-flex h-12 w-12 items-center justify-center rounded-[1.2rem] shadow-inner',
                              isActive ? 'bg-white/10 text-white' : 'bg-white/85 text-stone-900',
                            )}
                          >
                            <item.icon className="h-5 w-5" />
                          </div>
                          <div>
                            <p className={cn('text-base font-black', isActive ? 'text-white' : 'text-stone-900')}>
                              {item.label}
                            </p>
                            <p className={cn('mt-1 text-sm leading-6', isActive ? 'text-white/70' : 'text-stone-600')}>
                              {adminPageMeta[item.to]?.description ?? 'tool ی تایبەتی ئادمین.'}
                            </p>
                          </div>
                        </div>
                      )}
                    </NavLink>
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          <div className="border-t border-stone-200 px-5 py-4 sm:px-6">
            <Button block variant="secondary" icon={<LogOut className="h-4 w-4" />} onClick={handleLogout}>
              چوونە دەرەوە
            </Button>
          </div>
        </aside>

        <div className="mx-auto max-w-[108rem] px-4 pb-12 pt-3 sm:px-6 xl:pb-10">
          <header className="sticky top-3 z-30 overflow-hidden rounded-[1.8rem] border border-white/70 bg-white/90 p-3 shadow-card backdrop-blur-md lg:p-4">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-r from-brand-100/45 via-transparent to-amber-100/45" />
            <div className="relative">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setAdminMenuOpen(true)}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.1rem] bg-stone-950 text-white shadow-card transition hover:bg-stone-800"
                    aria-label="کردنەوەی مینو"
                  >
                    <Menu className="h-4.5 w-4.5" />
                  </button>
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <div className="inline-flex min-w-0 items-center gap-2 rounded-[1.2rem] bg-gradient-to-r from-stone-950 via-stone-900 to-brand-900 px-3.5 py-2 text-white shadow-card">
                      <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.9rem] bg-white/10">
                        <LayoutDashboard className="h-4 w-4" />
                      </div>
                      <p className="truncate text-sm font-black tracking-tight lg:text-base">
                        {sessionRoleLabel}: {session.displayName}
                      </p>
                    </div>
                    <div className="inline-flex min-w-0 items-center gap-2 rounded-[1.2rem] border border-stone-200 bg-stone-100/90 px-3.5 py-2 text-stone-800 shadow-sm">
                      <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.9rem] bg-white text-stone-700">
                        <CurrentPageIcon className="h-4 w-4" />
                      </div>
                      <p className="truncate text-sm font-black tracking-tight lg:text-base">{currentPageLabel}</p>
                    </div>
                  </div>
                </div>

                <div className="flex w-full min-w-0 items-center justify-between gap-3 overflow-hidden xl:flex-1" dir="ltr">
                  <div className="shrink-0">
                    <Button
                      variant="secondary"
                      icon={<LogOut className="h-4 w-4" />}
                      onClick={handleLogout}
                      className="px-3 py-2.5"
                    >
                      دەرچوون
                    </Button>
                  </div>
                  <div className="flex min-w-0 flex-1 justify-end overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <div className="flex shrink-0 items-center gap-2">
                      <nav className="flex shrink-0 flex-row-reverse items-center gap-2" aria-label="Admin quick access">
                        {adminQuickAccessItems.map((item) => (
                          <NavLink
                            key={item.to}
                            to={item.to}
                            title={item.label}
                            aria-label={item.label}
                            className={({ isActive }) =>
                              cn(
                                'inline-flex h-10 w-10 items-center justify-center rounded-[1rem] border shadow-sm transition',
                                isActive ? 'border-stone-900 bg-stone-950 text-white' : item.tone,
                              )
                            }
                          >
                            <item.icon className="h-4.5 w-4.5" />
                            <span className="sr-only">{item.label}</span>
                          </NavLink>
                        ))}
                      </nav>
                      {headerActions ? <div className="flex flex-wrap items-center gap-3">{headerActions}</div> : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <main className="mt-4 space-y-6">
            {!isAdminDashboard ? (
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="secondary"
                  icon={<ArrowRight className="h-4 w-4" />}
                  onClick={handleAdminBack}
                  className="shrink-0 px-3 py-2.5"
                >
                  گەڕانەوە
                </Button>
                <div className="inline-flex min-w-0 items-center gap-2 rounded-[1.2rem] border border-stone-200 bg-white px-3.5 py-2.5 text-stone-800 shadow-sm">
                  <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.9rem] bg-stone-100 text-stone-700">
                    <CurrentPageIcon className="h-4.5 w-4.5" />
                  </div>
                  <p className="truncate text-sm font-black tracking-tight lg:text-base">{currentPageLabel}</p>
                </div>
              </div>
            ) : null}

            {children}
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sand bg-grain text-stone-900">
      <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-80 bg-gradient-to-b from-brand-100/70 via-transparent to-transparent" />

      <div className="mx-auto max-w-7xl p-4 pb-16 sm:p-6">
        <header className="sticky top-4 z-30 mb-6 overflow-hidden rounded-4xl border border-white/70 bg-white/80 p-4 shadow-card backdrop-blur-md">
          <div className="relative space-y-5">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="inline-flex items-center rounded-full bg-gradient-to-r from-sky-700 via-brand-800 to-olive-700 px-5 py-2.5 text-sm font-black text-white shadow-card">
                    {getRoleLabel(session.role)}: {session.displayName}
                  </div>
                  <div className="inline-flex items-center rounded-full bg-stone-100 px-4 py-2 text-sm font-bold text-stone-800">
                    {currentPageLabel}
                  </div>
                </div>

                <div className="space-y-2">
                  <h1 className="text-2xl font-black tracking-tight text-stone-900 md:text-3xl">{title}</h1>
                  {subtitle ? <p className="max-w-3xl text-sm leading-7 text-stone-600">{subtitle}</p> : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {headerActions}
                <Button variant="secondary" icon={<LogOut className="h-4 w-4" />} onClick={handleLogout}>
                  دەرچوون
                </Button>
              </div>
            </div>

            {navItems.length > 0 ? (
              <nav className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        'inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition',
                        isActive
                          ? 'bg-brand-700 text-white shadow-card'
                          : 'bg-stone-100 text-stone-700 hover:bg-stone-200',
                      )
                    }
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </nav>
            ) : null}
          </div>
        </header>

        <main className="space-y-6">{children}</main>
      </div>
    </div>
  );
};
