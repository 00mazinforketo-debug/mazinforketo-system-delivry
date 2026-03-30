import { Outlet } from 'react-router-dom';
import { DashboardShell } from '../../components/shared/DashboardShell';
import { adminNavItems, adminUtilityNavItems } from '../../config/navigation';

export const AdminLayout = () => (
  <DashboardShell title="داشبۆردی ئادمین" navItems={adminNavItems} utilityItems={adminUtilityNavItems}>
    <Outlet />
  </DashboardShell>
);
