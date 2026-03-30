import type { MiddlewareHandler } from 'hono';
import type { AppBindings, AppVariables } from '../env';

const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('employee', 'captain', 'admin')),
  pin_hash TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY CHECK (id = 'app'),
  business_name TEXT NOT NULL,
  province_options_json TEXT NOT NULL,
  order_sequence INTEGER NOT NULL DEFAULT 0,
  seeded_at TEXT,
  last_reset_at TEXT,
  support_note TEXT NOT NULL,
  delivery_mobile_block_enabled INTEGER NOT NULL DEFAULT 1,
  hidden_category_ids_json TEXT NOT NULL,
  hidden_menu_item_ids_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  original_data_url TEXT NOT NULL,
  preview_data_url TEXT NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price REAL NOT NULL,
  image TEXT NOT NULL,
  image_asset_id TEXT,
  is_available INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
  FOREIGN KEY (image_asset_id) REFERENCES media_assets(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  mobile_number TEXT NOT NULL,
  province TEXT NOT NULL,
  extra_address TEXT NOT NULL,
  note TEXT NOT NULL,
  special_requests TEXT NOT NULL,
  subtotal REAL NOT NULL,
  total REAL NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending_captain', 'accepted', 'completed', 'cancelled')),
  created_by_role TEXT NOT NULL CHECK (created_by_role IN ('employee', 'captain', 'admin')),
  created_by_name TEXT NOT NULL,
  created_by_user_id TEXT,
  created_at TEXT NOT NULL,
  accepted_at TEXT,
  completed_at TEXT,
  updated_at TEXT NOT NULL,
  cancel_reason TEXT NOT NULL,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  name TEXT NOT NULL,
  image TEXT,
  price REAL NOT NULL,
  quantity INTEGER NOT NULL,
  line_total REAL NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  target_role TEXT NOT NULL CHECK (target_role IN ('employee', 'captain', 'admin')),
  target_display_name TEXT,
  order_id TEXT NOT NULL,
  order_number TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS delivery_orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  mobile_number TEXT NOT NULL,
  province TEXT NOT NULL,
  extra_address TEXT NOT NULL,
  note TEXT NOT NULL,
  special_requests TEXT NOT NULL,
  subtotal REAL NOT NULL,
  total REAL NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending_captain', 'accepted', 'completed', 'cancelled')),
  created_by_role TEXT NOT NULL CHECK (created_by_role IN ('employee', 'captain', 'admin')),
  created_by_name TEXT NOT NULL,
  created_by_user_id TEXT,
  created_at TEXT NOT NULL,
  accepted_at TEXT,
  completed_at TEXT,
  updated_at TEXT NOT NULL,
  cancel_reason TEXT NOT NULL,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS delivery_order_items (
  id TEXT PRIMARY KEY,
  delivery_order_id TEXT NOT NULL,
  name TEXT NOT NULL,
  image TEXT,
  price REAL NOT NULL,
  quantity INTEGER NOT NULL,
  line_total REAL NOT NULL,
  FOREIGN KEY (delivery_order_id) REFERENCES delivery_orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS delivery_notifications (
  id TEXT PRIMARY KEY,
  target_role TEXT NOT NULL CHECK (target_role IN ('employee', 'captain', 'admin')),
  target_display_name TEXT,
  delivery_order_id TEXT NOT NULL,
  delivery_order_number TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (delivery_order_id) REFERENCES delivery_orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  actor_role TEXT NOT NULL CHECK (actor_role IN ('employee', 'captain', 'admin', 'system')),
  actor_name TEXT NOT NULL,
  order_id TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON categories(sort_order, name);
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_sort_order ON menu_items(sort_order, name);
CREATE INDEX IF NOT EXISTS idx_menu_items_image_asset_id ON menu_items(image_asset_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_created_at ON media_assets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_creator_user_id ON orders(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_notifications_target_role ON notifications(target_role, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_order_id ON notifications(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_created_at ON delivery_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_status ON delivery_orders(status);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_mobile_number ON delivery_orders(mobile_number);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_creator_user_id ON delivery_orders(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_order_items_delivery_order_id ON delivery_order_items(delivery_order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_notifications_target_role ON delivery_notifications(target_role, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_notifications_order_id ON delivery_notifications(delivery_order_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_order_id ON activity_logs(order_id);

CREATE TABLE IF NOT EXISTS order_counters (
  scope TEXT PRIMARY KEY,
  next_value INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

INSERT INTO order_counters (scope, next_value, updated_at)
SELECT 'orders', order_sequence, COALESCE(updated_at, CURRENT_TIMESTAMP)
FROM settings
WHERE id = 'app'
AND NOT EXISTS (
  SELECT 1 FROM order_counters WHERE scope = 'orders'
);

INSERT INTO order_counters (scope, next_value, updated_at)
SELECT 'delivery_orders', 0, COALESCE(updated_at, CURRENT_TIMESTAMP)
FROM settings
WHERE id = 'app'
AND NOT EXISTS (
  SELECT 1 FROM order_counters WHERE scope = 'delivery_orders'
);

CREATE INDEX IF NOT EXISTS idx_order_counters_updated_at ON order_counters(updated_at DESC);
`;

const SCHEMA_STATEMENTS = SCHEMA_SQL
  .split(/;\s*(?:\r?\n|$)/)
  .map((statement) => statement.trim())
  .filter(Boolean);

let schemaReadyPromise: Promise<void> | null = null;

const ensureSettingsColumns = async (env: AppBindings) => {
  const columns = await env.DB.prepare('PRAGMA table_info(settings)').all<{ name: string }>();
  const columnNames = new Set((columns.results ?? []).map((column) => String(column.name ?? '')));
  const statements = [];

  if (!columnNames.has('delivery_mobile_block_enabled')) {
    statements.push(
      env.DB.prepare('ALTER TABLE settings ADD COLUMN delivery_mobile_block_enabled INTEGER NOT NULL DEFAULT 1'),
    );
  }

  if (statements.length > 0) {
    await env.DB.batch(statements);
  }
};

export const ensureDatabaseSchema = async (env: AppBindings) => {
  if (!schemaReadyPromise) {
    schemaReadyPromise = env.DB.batch(SCHEMA_STATEMENTS.map((statement) => env.DB.prepare(statement)))
      .then(async () => {
        await ensureSettingsColumns(env);
      })
      .catch((error) => {
        schemaReadyPromise = null;
        throw error;
      });
  }

  return schemaReadyPromise;
};

export const bootstrapDatabase: MiddlewareHandler<{ Bindings: AppBindings; Variables: AppVariables }> = async (c, next) => {
  await ensureDatabaseSchema(c.env);
  await next();
};
