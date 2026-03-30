import { Activity, BarChart3, BellRing, ClipboardList, FolderKanban, ImagePlus, Images, LayoutDashboard, Settings2, Truck, Users } from 'lucide-react';
import type { NavItem } from '../components/shared/DashboardShell';
import type { UserRole } from '../types/models';

export const captainNavItems: NavItem[] = [
  { to: '/captain', label: 'سەرەکی', icon: ClipboardList, end: true },
  { to: '/captain/orders', label: 'سەفەری', icon: ClipboardList },
  { to: '/captain/delivery', label: 'گەیاندن', icon: Truck },
];

export const adminNavItems: NavItem[] = [
  { to: '/admin', label: 'داشبۆرد', icon: LayoutDashboard, end: true },
  { to: '/admin/orders', label: 'سەفەری ، گەیاندن', shortLabel: 'سەفەری ، گەیاندن', icon: ClipboardList },
  { to: '/admin/delivery-orders', label: 'گەیاندن', icon: Truck },
  { to: '/admin/all-foods', label: 'هەموو خواردنەکان', shortLabel: 'خواردنەکان', icon: FolderKanban },
  { to: '/admin/menu-images', label: 'وێنەی هەڵگیراوەکان', shortLabel: 'وێنەکان', icon: ImagePlus },
  { to: '/admin/notifications', label: 'ئاگەدارکردنەوەکانی سەفەری', shortLabel: 'ئاگەدارکردنەوە', icon: BellRing },
];

export const adminUtilityNavItems: NavItem[] = [
  { to: '/admin/reports', label: 'ڕاپۆرتەکان', icon: BarChart3 },
  { to: '/admin/employee-activity', label: 'چاڵاکی کارمەند', shortLabel: 'چاڵاکی', icon: Users },
  { to: '/admin/media', label: 'پەڕگەکان', shortLabel: 'پەڕگەکان', icon: Images },
  { to: '/admin/activity', label: 'چالاکی', icon: Activity },
  { to: '/admin/settings', label: 'ڕێکخستن', icon: Settings2 },
];

export const getNavItemsForRole = (role: UserRole): NavItem[] => {
  switch (role) {
    case 'captain':
      return captainNavItems;
    case 'admin':
      return adminNavItems;
    default:
      return [];
  }
};
