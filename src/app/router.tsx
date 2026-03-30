import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { adminNavItems, adminUtilityNavItems, getNavItemsForRole } from '../config/navigation';
import { AdminActivityPage } from '../features/admin/AdminActivityPage';
import { AdminAllFoodsPage } from '../features/admin/AdminAllFoodsPage';
import { AdminBusinessSettingsPage } from '../features/admin/AdminBusinessSettingsPage';
import { AdminCatalogSettingsPage } from '../features/admin/AdminCatalogSettingsPage';
import { AdminDeliveryOrdersPage } from '../features/delivery/AdminDeliveryOrdersPage';
import { AdminEmployeeActivityPage } from '../features/admin/AdminEmployeeActivityPage';
import { AdminLayout } from '../features/admin/AdminLayout';
import { AdminMaintenancePage } from '../features/admin/AdminMaintenancePage';
import { AdminMediaPage } from '../features/admin/AdminMediaPage';
import { AdminMenuImagesPage } from '../features/admin/AdminMenuImagesPage';
import { AdminNotificationsPage } from '../features/admin/AdminNotificationsPage';
import { AdminOrdersPage } from '../features/admin/AdminOrdersPage';
import { AdminOverviewPage } from '../features/admin/AdminOverviewPage';
import { AdminReportsPage } from '../features/admin/AdminReportsPage';
import { AdminSettingsPage } from '../features/admin/AdminSettingsPage';
import { AdminStoragePage } from '../features/admin/AdminStoragePage';
import { getRoleHomePath } from '../features/auth/auth';
import { LoginPage } from '../features/auth/LoginPage';
import { CaptainAboutPage } from '../features/captain/CaptainAboutPage';
import { CaptainHistoryPage } from '../features/captain/CaptainHistoryPage';
import { CaptainNotificationsPage } from '../features/captain/CaptainNotificationsPage';
import { CaptainOrdersPage } from '../features/captain/CaptainOrdersPage';
import { CaptainPage } from '../features/captain/CaptainPage';
import { CaptainSettingsPage } from '../features/captain/CaptainSettingsPage';
import { DeliveryOrderDetailsPage } from '../features/delivery/DeliveryOrderDetailsPage';
import { EmployeeAboutPage } from '../features/employee/EmployeeAboutPage';
import { EmployeeCartPage } from '../features/employee/EmployeeCartPage';
import { EmployeeCheckoutPage } from '../features/employee/EmployeeCheckoutPage';
import { EmployeeCheckoutSettingsPage } from '../features/employee/EmployeeCheckoutSettingsPage';
import { EmployeeDeliveryOrdersPage } from '../features/delivery/EmployeeDeliveryOrdersPage';
import { EmployeeDataClearPage } from '../features/employee/EmployeeDataClearPage';
import { EmployeeMenuManagementPage } from '../features/employee/EmployeeMenuManagementPage';
import { EmployeeMyOrdersPage } from '../features/employee/EmployeeMyOrdersPage';
import { EmployeeNotificationsPage } from '../features/employee/EmployeeNotificationsPage';
import { EmployeeOrdersPage } from '../features/employee/EmployeeOrdersPage';
import { EmployeePage } from '../features/employee/EmployeePage';
import { EmployeeSettingsPage } from '../features/employee/EmployeeSettingsPage';
import { OrderDetailsPage } from '../features/orders/OrderDetailsPage';
import { useSessionStore } from '../stores/session-store';
import type { UserRole } from '../types/models';

const ProtectedRoute = ({ roles }: { roles?: UserRole[] }) => {
  const session = useSessionStore((state) => state.session);

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(session.role) && session.role !== 'admin') {
    return <Navigate to={getRoleHomePath(session.role)} replace />;
  }

  return <Outlet />;
};

const PublicOnlyRoute = () => {
  const session = useSessionStore((state) => state.session);
  if (session) {
    return <Navigate to={getRoleHomePath(session.role)} replace />;
  }

  return <Outlet />;
};

const HomeRedirect = () => {
  const session = useSessionStore((state) => state.session);
  return <Navigate to={session ? getRoleHomePath(session.role) : '/login'} replace />;
};

const SettingsRedirect = () => {
  const session = useSessionStore((state) => state.session);
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (session.role !== 'admin') {
    return <Navigate to={getRoleHomePath(session.role)} replace />;
  }

  return <Navigate to="/admin/settings" replace />;
};

const AdminOrderDetailsPage = () => (
  <OrderDetailsPage navItems={adminNavItems} utilityItems={adminUtilityNavItems} shellTitle="وردەکاری سەفەری" />
);

const AdminDeliveryDetailsPage = () => (
  <DeliveryOrderDetailsPage navItems={adminNavItems} utilityItems={adminUtilityNavItems} shellTitle="وردەکاری گەیاندن" />
);

const RoleOrderDetailsPage = () => {
  const session = useSessionStore((state) => state.session);
  if (!session) {
    return null;
  }

  return <OrderDetailsPage navItems={getNavItemsForRole(session.role)} shellTitle="وردەکاری سەفەری" />;
};

const RoleDeliveryOrderDetailsPage = () => {
  const session = useSessionStore((state) => state.session);
  if (!session) {
    return null;
  }

  return <DeliveryOrderDetailsPage navItems={getNavItemsForRole(session.role)} shellTitle="وردەکاری گەیاندن" />;
};

export const AppRouter = () => (
  <Routes>
    <Route element={<PublicOnlyRoute />}>
      <Route path="/login" element={<LoginPage />} />
    </Route>

    <Route path="/" element={<HomeRedirect />} />
    <Route path="/settings" element={<SettingsRedirect />} />

    <Route element={<ProtectedRoute roles={['employee']} />}>
      <Route path="/employee" element={<EmployeePage />} />
      <Route path="/employee/cart" element={<EmployeeCartPage />} />
      <Route path="/employee/checkout" element={<EmployeeCheckoutPage />} />
      <Route path="/employee/my-orders" element={<EmployeeMyOrdersPage />} />
      <Route path="/employee/my-orders/date" element={<Navigate to="/employee/my-orders" replace />} />
      <Route path="/employee/orders" element={<EmployeeOrdersPage />} />
      <Route path="/employee/delivery-orders" element={<EmployeeDeliveryOrdersPage />} />
      <Route path="/employee/history" element={<Navigate to="/employee" replace />} />
      <Route path="/employee/notifications" element={<EmployeeNotificationsPage />} />
      <Route path="/employee/about" element={<EmployeeAboutPage />} />
      <Route path="/employee/settings" element={<EmployeeSettingsPage />} />
      <Route path="/employee/settings/checkout" element={<EmployeeCheckoutSettingsPage />} />
      <Route path="/employee/settings/menu" element={<EmployeeMenuManagementPage />} />
      <Route path="/employee/settings/data" element={<EmployeeDataClearPage />} />
    </Route>

    <Route element={<ProtectedRoute roles={['captain']} />}>
      <Route path="/captain" element={<CaptainPage />} />
      <Route path="/captain/orders" element={<CaptainOrdersPage />} />
      <Route path="/captain/history" element={<CaptainHistoryPage />} />
      <Route path="/captain/delivery" element={<Navigate to="/captain/orders" replace />} />
      <Route path="/captain/notifications" element={<CaptainNotificationsPage />} />
      <Route path="/captain/about" element={<CaptainAboutPage />} />
      <Route path="/captain/settings" element={<CaptainSettingsPage />} />
    </Route>

    <Route element={<ProtectedRoute roles={['admin']} />}>
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminOverviewPage />} />
        <Route path="orders" element={<AdminOrdersPage />} />
        <Route path="delivery-orders" element={<AdminDeliveryOrdersPage />} />
        <Route path="all-foods" element={<AdminAllFoodsPage />} />
        <Route path="menu" element={<Navigate to="/admin/all-foods?tab=items" replace />} />
        <Route path="categories" element={<Navigate to="/admin/all-foods?tab=categories" replace />} />
        <Route path="menu-images" element={<AdminMenuImagesPage />} />
        <Route path="notifications" element={<AdminNotificationsPage />} />
        <Route path="reports" element={<AdminReportsPage />} />
        <Route path="employee-activity" element={<AdminEmployeeActivityPage />} />
        <Route path="media" element={<AdminMediaPage />} />
        <Route path="activity" element={<AdminActivityPage />} />
        <Route path="settings" element={<AdminSettingsPage />} />
        <Route path="settings/business" element={<AdminBusinessSettingsPage />} />
        <Route path="settings/catalog" element={<AdminCatalogSettingsPage />} />
        <Route path="settings/storage" element={<AdminStoragePage />} />
        <Route path="settings/maintenance" element={<AdminMaintenancePage />} />
      </Route>
      <Route path="/admin/orders/:id" element={<AdminOrderDetailsPage />} />
      <Route path="/admin/delivery-orders/:id" element={<AdminDeliveryDetailsPage />} />
    </Route>

    <Route element={<ProtectedRoute />}>
      <Route path="/orders/:id" element={<RoleOrderDetailsPage />} />
      <Route path="/delivery-orders/:id" element={<RoleDeliveryOrderDetailsPage />} />
    </Route>

    <Route path="*" element={<HomeRedirect />} />
  </Routes>
);
