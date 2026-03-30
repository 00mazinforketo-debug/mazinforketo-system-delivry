import {
  Bell,
  FileText,
  House,
  Info,
  LogOut,
  Settings2,
  ShoppingCart,
  SquareMenu,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/cn';
import { useSessionStore } from '../../stores/session-store';
import { NotificationBell } from '../notifications/NotificationBell';

export const EmployeeShell = ({ children }: { children: ReactNode }) => {
  const session = useSessionStore((state) => state.session);
  const logout = useSessionStore((state) => state.logout);
  const navigate = useNavigate();
  const location = useLocation();

  if (!session) {
    return null;
  }

  const pageConfig: Array<{ match: (pathname: string) => boolean; label: string; icon: LucideIcon }> = [
    { match: (pathname) => pathname === '/employee', label: 'سەرەکی', icon: House },
    { match: (pathname) => pathname === '/employee/cart', label: 'سەبەتەی کڕین', icon: ShoppingCart },
    { match: (pathname) => pathname === '/employee/checkout', label: 'تەواوکردنی داواکاری', icon: ShoppingCart },
    { match: (pathname) => pathname === '/employee/my-orders', label: 'ئۆردەرەکانم', icon: SquareMenu },
    { match: (pathname) => pathname === '/employee/orders', label: 'سەفەری', icon: SquareMenu },
    { match: (pathname) => pathname === '/employee/delivery-orders', label: 'گەیاندن', icon: Truck },
    { match: (pathname) => pathname === '/employee/notifications', label: 'ئاگەدارکردنەوەکان', icon: Bell },
    { match: (pathname) => pathname === '/employee/settings', label: 'ڕێخستن', icon: Settings2 },
    { match: (pathname) => pathname === '/employee/about', label: 'دەربارە', icon: Info },
    { match: (pathname) => pathname === '/employee/settings/checkout', label: 'ڕێخستنی تەواو کردنی داواکاری', icon: Settings2 },
    { match: (pathname) => pathname === '/employee/settings/menu', label: 'بەڕێوبردنی مینو', icon: Settings2 },
    { match: (pathname) => pathname === '/employee/settings/data', label: 'سڕینەوەی داتا', icon: Settings2 },
    { match: (pathname) => pathname.startsWith('/orders/'), label: 'وردەکاری سەفەری', icon: FileText },
    { match: (pathname) => pathname.startsWith('/delivery-orders/'), label: 'وردەکاری گەیاندن', icon: Truck },
  ];

  const currentPage = pageConfig.find((item) => item.match(location.pathname)) ?? pageConfig[0];
  const CurrentPageIcon = currentPage.icon;
  const isOrdersSection =
    location.pathname === '/employee/my-orders' ||
    location.pathname === '/employee/orders' ||
    location.pathname === '/employee/delivery-orders' ||
    location.pathname.startsWith('/orders/') ||
    location.pathname.startsWith('/delivery-orders/');
  const isAboutSection = location.pathname === '/employee/about';
  const isSettingsSection = location.pathname === '/employee/settings' || location.pathname.startsWith('/employee/settings/');

  const navClassName = (isActive: boolean) =>
    cn(
      'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition',
      isActive ? 'bg-brand-700 text-white shadow-card' : 'bg-stone-100 text-stone-700 hover:bg-stone-200',
    );

  return (
    <div className="min-h-screen bg-sand bg-grain text-stone-900">
      <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-72 bg-gradient-to-b from-brand-100/70 via-transparent to-transparent" />
      <div className="mx-auto max-w-7xl p-4 pb-16 sm:p-6">
        <header className="sticky top-4 z-30 mb-6 rounded-4xl border border-white/80 bg-white/90 p-4 shadow-card backdrop-blur-md">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center rounded-full bg-gradient-to-r from-brand-700 via-brand-800 to-olive-700 px-5 py-2.5 text-sm font-black text-white shadow-card">
                کارمەند: {session.displayName}
              </div>
              <NotificationBell to="/employee/notifications" />
              <div className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-4 py-2 text-sm font-bold text-stone-800">
                <CurrentPageIcon className="h-4 w-4" />
                <span>{currentPage.label}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 overflow-hidden" dir="ltr">
              <div className="shrink-0">
                <Button
                  variant="secondary"
                  className="h-11 w-11 rounded-2xl p-0"
                  icon={<LogOut className="h-5 w-5" />}
                  title="چوونە دەرەوە"
                  aria-label="چوونە دەرەوە"
                  onClick={() => {
                    logout();
                    navigate('/login');
                  }}
                />
              </div>
              <div className="h-8 w-px shrink-0 bg-stone-200" />
              <div className="flex min-w-0 flex-1 justify-end overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="flex shrink-0 flex-row-reverse flex-nowrap items-center gap-1.5">
                  <NavLink end to="/employee" className={({ isActive }) => navClassName(isActive)} title="سەرەکی" aria-label="سەرەکی">
                    <House className="h-5 w-5" />
                  </NavLink>
                  <NavLink
                    to="/employee/cart"
                    className={({ isActive }) => navClassName(isActive)}
                    title="سەبەتەی کڕین"
                    aria-label="سەبەتەی کڕین"
                  >
                    <ShoppingCart className="h-5 w-5" />
                  </NavLink>
                  <NavLink
                    to="/employee/my-orders"
                    className={() => navClassName(isOrdersSection)}
                    title="ئۆردەرەکانم"
                    aria-label="ئۆردەرەکانم"
                  >
                    <SquareMenu className="h-5 w-5" />
                  </NavLink>
                  <NavLink
                    to="/employee/settings"
                    className={() => navClassName(isSettingsSection)}
                    title="ڕێخستن"
                    aria-label="ڕێخستن"
                  >
                    <Settings2 className="h-5 w-5" />
                  </NavLink>
                  <NavLink
                    to="/employee/about"
                    className={() => navClassName(isAboutSection)}
                    title="دەربارە"
                    aria-label="دەربارە"
                  >
                    <Info className="h-5 w-5" />
                  </NavLink>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="space-y-6">{children}</main>
      </div>
    </div>
  );
};
