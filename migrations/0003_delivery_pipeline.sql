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

INSERT INTO order_counters (scope, next_value, updated_at)
SELECT 'delivery_orders', 0, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM order_counters WHERE scope = 'delivery_orders'
);

CREATE INDEX IF NOT EXISTS idx_delivery_orders_created_at ON delivery_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_status ON delivery_orders(status);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_mobile_number ON delivery_orders(mobile_number);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_creator_user_id ON delivery_orders(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_order_items_delivery_order_id ON delivery_order_items(delivery_order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_notifications_target_role ON delivery_notifications(target_role, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_notifications_order_id ON delivery_notifications(delivery_order_id);
