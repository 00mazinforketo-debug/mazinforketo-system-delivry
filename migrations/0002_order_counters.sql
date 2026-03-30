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

CREATE INDEX IF NOT EXISTS idx_order_counters_updated_at ON order_counters(updated_at DESC);
