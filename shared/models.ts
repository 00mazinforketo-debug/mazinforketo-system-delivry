export type UserRole = 'employee' | 'captain' | 'admin';

export type OrderStatus = 'pending_captain' | 'accepted' | 'completed' | 'cancelled';
export type OrderMode = 'travel' | 'delivery';

export type SyncEventType =
  | 'order-created'
  | 'order-updated'
  | 'delivery-order-created'
  | 'delivery-order-updated'
  | 'notification-changed'
  | 'delivery-notification-changed'
  | 'view-state-changed'
  | 'menu-changed'
  | 'catalog-changed'
  | 'media-changed'
  | 'settings-changed'
  | 'reset-performed';

export interface Session {
  userId: string;
  role: UserRole;
  displayName: string;
  loginAt: string;
}

export interface KnownUser {
  role: UserRole;
  displayName: string;
}

export interface OrderItem {
  id: string;
  name: string;
  image?: string;
  price: number;
  quantity: number;
  lineTotal: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  mobileNumber: string;
  province: string;
  extraAddress: string;
  note: string;
  specialRequests: string;
  items: OrderItem[];
  subtotal: number;
  total: number;
  status: OrderStatus;
  createdByRole: UserRole;
  createdByName: string;
  createdByUserId?: string | null;
  createdAt: string;
  acceptedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  cancelReason: string;
  offlineState?: 'queued' | 'syncing';
  queuedAt?: string | null;
  syncError?: string | null;
}

export interface DeliveryOrderItem {
  id: string;
  name: string;
  image?: string;
  price: number;
  quantity: number;
  lineTotal: number;
}

export interface DeliveryOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  mobileNumber: string;
  province: string;
  extraAddress: string;
  note: string;
  specialRequests: string;
  items: DeliveryOrderItem[];
  subtotal: number;
  total: number;
  status: OrderStatus;
  createdByRole: UserRole;
  createdByName: string;
  createdByUserId?: string | null;
  createdAt: string;
  acceptedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  cancelReason: string;
  offlineState?: 'queued' | 'syncing';
  queuedAt?: string | null;
  syncError?: string | null;
}

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  image: string;
  imageAssetId?: string | null;
  isAvailable: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface MediaAsset {
  id: string;
  kind: 'menu-image';
  fileName: string;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  originalDataUrl: string;
  previewDataUrl: string;
  r2Key?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  id: 'app';
  businessName: string;
  provinceOptions: string[];
  orderSequence: number;
  seededAt: string | null;
  lastResetAt: string | null;
  supportNote: string;
  deliveryMobileBlockEnabled: boolean;
  hiddenCategoryIds: string[];
  hiddenMenuItemIds: string[];
  updatedAt: string;
}

export interface ActivityLog {
  id: string;
  type: string;
  message: string;
  actorRole: UserRole | 'system';
  actorName: string;
  orderId?: string | null;
  metadataJson?: string | null;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  targetRole: UserRole;
  targetDisplayName: string | null;
  orderId: string;
  orderNumber: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface DeliveryNotification {
  id: string;
  targetRole: UserRole;
  targetDisplayName: string | null;
  deliveryOrderId: string;
  deliveryOrderNumber: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface Actor {
  role: UserRole | 'system';
  displayName: string;
}

export interface SyncEvent {
  type: SyncEventType;
  at: string;
  entityId?: string;
}

export interface BackupPayload {
  exportedAt: string;
  settings: AppSettings;
  categories: Category[];
  menuItems: MenuItem[];
  mediaAssets: MediaAsset[];
  orders: Order[];
  deliveryOrders: DeliveryOrder[];
  activityLogs: ActivityLog[];
  notifications: NotificationItem[];
  deliveryNotifications: DeliveryNotification[];
}

export interface AuthSessionDto {
  session: Session;
}

export interface ReportsDailySeriesPoint {
  dayKey: string;
  orderCount: number;
  revenue: number;
}

export interface ReportsSummaryDto {
  totals: {
    orders: number;
    revenue: number;
    pending: number;
    completed: number;
    cancelled: number;
    menuItems: number;
    availableMenuItems: number;
    unavailableMenuItems: number;
    categories: number;
    notifications: number;
  };
  businessTimeZone: string;
  generatedAt: string;
  dailySeries: ReportsDailySeriesPoint[];
  employeeActivity: EmployeeActivityReport;
}

export interface UserSummary {
  id: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DeleteOrdersPreviewDto {
  rangeType: 'yesterday' | 'single_day' | 'custom_range';
  roles: UserRole[];
  fromDate: string;
  toDate: string;
  includeTravelOrders: boolean;
  includeDeliveryOrders: boolean;
  includeTravelNotifications: boolean;
  includeDeliveryNotifications: boolean;
  includeActivityLogs: boolean;
  travelOrders: number;
  deliveryOrders: number;
  travelNotifications: number;
  deliveryNotifications: number;
  totalRecords: number;
  activityLogCount: number;
  totalSalesImpact: number;
}

export interface OrdersNotificationsSummaryDto {
  travelOrders: number;
  deliveryOrders: number;
  travelNotifications: number;
  deliveryNotifications: number;
  totalOrders: number;
  totalNotifications: number;
}

export interface EmployeeActivityDaySummary {
  dayKey: string;
  orderCount: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  estimatedWorkMinutes: number;
  totalSales: number;
}

export interface EmployeeActivitySummary {
  displayName: string;
  totalOrders: number;
  activeDays: number;
  estimatedWorkMinutes: number;
  totalSales: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  completedOrders: number;
  acceptedOrders: number;
  pendingOrders: number;
  cancelledOrders: number;
  averageOrdersPerDay: number;
  days: EmployeeActivityDaySummary[];
  busiestDay: EmployeeActivityDaySummary | null;
}

export interface EmployeeActivityReport {
  employees: EmployeeActivitySummary[];
  rankedEmployees: EmployeeActivitySummary[];
  totalEmployeeOrders: number;
  totalEstimatedWorkMinutes: number;
  activeEmployeeCount: number;
  topPerformer: EmployeeActivitySummary | null;
}




