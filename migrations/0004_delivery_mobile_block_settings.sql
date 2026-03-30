ALTER TABLE settings ADD COLUMN delivery_mobile_block_enabled INTEGER NOT NULL DEFAULT 1;

UPDATE settings
SET delivery_mobile_block_enabled = 1
WHERE delivery_mobile_block_enabled IS NULL;
