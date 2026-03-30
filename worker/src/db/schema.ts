import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  displayName: text('display_name').notNull(),
  role: text('role').notNull(),
  pinHash: text('pin_hash').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  tokenHash: text('token_hash').notNull(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull(),
  lastSeenAt: text('last_seen_at').notNull(),
});

export const settings = sqliteTable('settings', {
  id: text('id').primaryKey(),
  businessName: text('business_name').notNull(),
  provinceOptionsJson: text('province_options_json').notNull(),
  orderSequence: integer('order_sequence').notNull().default(0),
  seededAt: text('seeded_at'),
  lastResetAt: text('last_reset_at'),
  supportNote: text('support_note').notNull(),
  deliveryMobileBlockEnabled: integer('delivery_mobile_block_enabled', { mode: 'boolean' }).notNull().default(true),
  hiddenCategoryIdsJson: text('hidden_category_ids_json').notNull(),
  hiddenMenuItemIdsJson: text('hidden_menu_item_ids_json').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const orderCounters = sqliteTable('order_counters', {
  scope: text('scope').primaryKey(),
  nextValue: integer('next_value').notNull().default(0),
  updatedAt: text('updated_at').notNull(),
});

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const mediaAssets = sqliteTable('media_assets', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull(),
  fileName: text('file_name').notNull(),
  mimeType: text('mime_type').notNull(),
  byteSize: integer('byte_size').notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  originalDataUrl: text('original_data_url').notNull(),
  previewDataUrl: text('preview_data_url').notNull(),
  r2Key: text('r2_key').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const menuItems = sqliteTable('menu_items', {
  id: text('id').primaryKey(),
  categoryId: text('category_id').notNull(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  price: real('price').notNull(),
  image: text('image').notNull(),
  imageAssetId: text('image_asset_id'),
  isAvailable: integer('is_available', { mode: 'boolean' }).notNull().default(true),
  sortOrder: integer('sort_order').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const orders = sqliteTable('orders', {
  id: text('id').primaryKey(),
  orderNumber: text('order_number').notNull(),
  customerName: text('customer_name').notNull(),
  mobileNumber: text('mobile_number').notNull(),
  province: text('province').notNull(),
  extraAddress: text('extra_address').notNull(),
  note: text('note').notNull(),
  specialRequests: text('special_requests').notNull(),
  subtotal: real('subtotal').notNull(),
  total: real('total').notNull(),
  status: text('status').notNull(),
  createdByRole: text('created_by_role').notNull(),
  createdByName: text('created_by_name').notNull(),
  createdByUserId: text('created_by_user_id'),
  createdAt: text('created_at').notNull(),
  acceptedAt: text('accepted_at'),
  completedAt: text('completed_at'),
  updatedAt: text('updated_at').notNull(),
  cancelReason: text('cancel_reason').notNull(),
});

export const orderItems = sqliteTable('order_items', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull(),
  name: text('name').notNull(),
  image: text('image'),
  price: real('price').notNull(),
  quantity: integer('quantity').notNull(),
  lineTotal: real('line_total').notNull(),
});

export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  targetRole: text('target_role').notNull(),
  targetDisplayName: text('target_display_name'),
  orderId: text('order_id').notNull(),
  orderNumber: text('order_number').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
});

export const deliveryOrders = sqliteTable('delivery_orders', {
  id: text('id').primaryKey(),
  orderNumber: text('order_number').notNull(),
  customerName: text('customer_name').notNull(),
  mobileNumber: text('mobile_number').notNull(),
  province: text('province').notNull(),
  extraAddress: text('extra_address').notNull(),
  note: text('note').notNull(),
  specialRequests: text('special_requests').notNull(),
  subtotal: real('subtotal').notNull(),
  total: real('total').notNull(),
  status: text('status').notNull(),
  createdByRole: text('created_by_role').notNull(),
  createdByName: text('created_by_name').notNull(),
  createdByUserId: text('created_by_user_id'),
  createdAt: text('created_at').notNull(),
  acceptedAt: text('accepted_at'),
  completedAt: text('completed_at'),
  updatedAt: text('updated_at').notNull(),
  cancelReason: text('cancel_reason').notNull(),
});

export const deliveryOrderItems = sqliteTable('delivery_order_items', {
  id: text('id').primaryKey(),
  deliveryOrderId: text('delivery_order_id').notNull(),
  name: text('name').notNull(),
  image: text('image'),
  price: real('price').notNull(),
  quantity: integer('quantity').notNull(),
  lineTotal: real('line_total').notNull(),
});

export const deliveryNotifications = sqliteTable('delivery_notifications', {
  id: text('id').primaryKey(),
  targetRole: text('target_role').notNull(),
  targetDisplayName: text('target_display_name'),
  deliveryOrderId: text('delivery_order_id').notNull(),
  deliveryOrderNumber: text('delivery_order_number').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
});

export const activityLogs = sqliteTable('activity_logs', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  message: text('message').notNull(),
  actorRole: text('actor_role').notNull(),
  actorName: text('actor_name').notNull(),
  orderId: text('order_id'),
  metadataJson: text('metadata_json'),
  createdAt: text('created_at').notNull(),
});
