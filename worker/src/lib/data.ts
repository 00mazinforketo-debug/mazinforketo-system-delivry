import type {
  ActivityLog,
  Actor,
  AppSettings,
  BackupPayload,
  Category,
  DeleteOrdersPreviewDto,
  MediaAsset,
  MenuItem,
  NotificationItem,
  Order,
  OrderItem,
  OrderStatus,
  ReportsSummaryDto,
  UserRole,
  UserSummary,
} from '../../../shared/models';
import { BUSINESS_TIME_ZONE, getBusinessDayKey } from '../../../shared/business-time';
import { buildEmployeeActivityReport } from './analytics';
import { buildDefaultSettings, DEFAULT_USERS } from './default-data';
import { arrayBufferToDataUrl, dataUrlToBytes, hashPin } from './crypto';
import type { AppBindings, AuthUser } from '../env';

type DbRow = Record<string, unknown>;

const SETTINGS_SELECT_SQL = `
SELECT
  id,
  business_name AS businessName,
  province_options_json AS provinceOptionsJson,
  order_sequence AS orderSequence,
  seeded_at AS seededAt,
  last_reset_at AS lastResetAt,
  support_note AS supportNote,
  delivery_mobile_block_enabled AS deliveryMobileBlockEnabled,
  hidden_category_ids_json AS hiddenCategoryIdsJson,
  hidden_menu_item_ids_json AS hiddenMenuItemIdsJson,
  updated_at AS updatedAt
FROM settings
WHERE id = 'app'
LIMIT 1
`;

const CATEGORY_SELECT_SQL = `
SELECT
  id,
  name,
  sort_order AS sortOrder,
  created_at AS createdAt,
  updated_at AS updatedAt
FROM categories
ORDER BY sort_order ASC, name COLLATE NOCASE ASC
`;

const MENU_ITEM_SELECT_SQL = `
SELECT
  id,
  category_id AS categoryId,
  name,
  description,
  price,
  image,
  image_asset_id AS imageAssetId,
  is_available AS isAvailable,
  sort_order AS sortOrder,
  created_at AS createdAt,
  updated_at AS updatedAt
FROM menu_items
ORDER BY sort_order ASC, name COLLATE NOCASE ASC
`;

const MEDIA_SELECT_SQL = `
SELECT
  id,
  kind,
  file_name AS fileName,
  mime_type AS mimeType,
  byte_size AS byteSize,
  width,
  height,
  original_data_url AS originalDataUrl,
  preview_data_url AS previewDataUrl,
  r2_key AS r2Key,
  created_at AS createdAt,
  updated_at AS updatedAt
FROM media_assets
ORDER BY updated_at DESC, created_at DESC
`;

const ORDER_SELECT_SQL = `
SELECT
  id,
  order_number AS orderNumber,
  customer_name AS customerName,
  mobile_number AS mobileNumber,
  province,
  extra_address AS extraAddress,
  note,
  special_requests AS specialRequests,
  subtotal,
  total,
  status,
  created_by_role AS createdByRole,
  created_by_name AS createdByName,
  created_by_user_id AS createdByUserId,
  created_at AS createdAt,
  accepted_at AS acceptedAt,
  completed_at AS completedAt,
  updated_at AS updatedAt,
  cancel_reason AS cancelReason
FROM orders
`;

const NOTIFICATION_SELECT_SQL = `
SELECT
  id,
  target_role AS targetRole,
  target_display_name AS targetDisplayName,
  order_id AS orderId,
  order_number AS orderNumber,
  title,
  message,
  is_read AS isRead,
  created_at AS createdAt
FROM notifications
`;

const ACTIVITY_SELECT_SQL = `
SELECT
  id,
  type,
  message,
  actor_role AS actorRole,
  actor_name AS actorName,
  order_id AS orderId,
  metadata_json AS metadataJson,
  created_at AS createdAt
FROM activity_logs
`;

const nowIso = () => new Date().toISOString();

const parseStringArray = (value: unknown) => {
  if (typeof value !== 'string') {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : [];
  } catch {
    return [];
  }
};

const boolFromDb = (value: unknown) => value === 1 || value === true || value === '1';

const asSettings = (row: DbRow): AppSettings => ({
  id: 'app',
  businessName: String(row.businessName ?? ''),
  provinceOptions: parseStringArray(row.provinceOptionsJson),
  orderSequence: Number(row.orderSequence ?? 0),
  seededAt: row.seededAt ? String(row.seededAt) : null,
  lastResetAt: row.lastResetAt ? String(row.lastResetAt) : null,
  supportNote: String(row.supportNote ?? ''),
  deliveryMobileBlockEnabled: row.deliveryMobileBlockEnabled === undefined ? true : boolFromDb(row.deliveryMobileBlockEnabled),
  hiddenCategoryIds: parseStringArray(row.hiddenCategoryIdsJson),
  hiddenMenuItemIds: parseStringArray(row.hiddenMenuItemIdsJson),
  updatedAt: String(row.updatedAt ?? ''),
});

const asCategory = (row: DbRow): Category => ({
  id: String(row.id ?? ''),
  name: String(row.name ?? ''),
  sortOrder: Number(row.sortOrder ?? 0),
  createdAt: String(row.createdAt ?? ''),
  updatedAt: String(row.updatedAt ?? ''),
});

const asMenuItem = (row: DbRow): MenuItem => ({
  id: String(row.id ?? ''),
  categoryId: String(row.categoryId ?? ''),
  name: String(row.name ?? ''),
  description: String(row.description ?? ''),
  price: Number(row.price ?? 0),
  image: String(row.image ?? ''),
  imageAssetId: row.imageAssetId ? String(row.imageAssetId) : null,
  isAvailable: boolFromDb(row.isAvailable),
  sortOrder: Number(row.sortOrder ?? 0),
  createdAt: String(row.createdAt ?? ''),
  updatedAt: String(row.updatedAt ?? ''),
});

const asMediaAsset = (row: DbRow): MediaAsset => ({
  id: String(row.id ?? ''),
  kind: 'menu-image',
  fileName: String(row.fileName ?? ''),
  mimeType: String(row.mimeType ?? ''),
  byteSize: Number(row.byteSize ?? 0),
  width: Number(row.width ?? 0),
  height: Number(row.height ?? 0),
  originalDataUrl: String(row.originalDataUrl ?? ''),
  previewDataUrl: String(row.previewDataUrl ?? ''),
  r2Key: row.r2Key ? String(row.r2Key) : null,
  createdAt: String(row.createdAt ?? ''),
  updatedAt: String(row.updatedAt ?? ''),
});

const asNotification = (row: DbRow): NotificationItem => ({
  id: String(row.id ?? ''),
  targetRole: String(row.targetRole ?? 'employee') as NotificationItem['targetRole'],
  targetDisplayName: row.targetDisplayName ? String(row.targetDisplayName) : null,
  orderId: String(row.orderId ?? ''),
  orderNumber: String(row.orderNumber ?? ''),
  title: String(row.title ?? ''),
  message: String(row.message ?? ''),
  isRead: boolFromDb(row.isRead),
  createdAt: String(row.createdAt ?? ''),
});

const asActivityLog = (row: DbRow): ActivityLog => ({
  id: String(row.id ?? ''),
  type: String(row.type ?? ''),
  message: String(row.message ?? ''),
  actorRole: String(row.actorRole ?? 'system') as ActivityLog['actorRole'],
  actorName: String(row.actorName ?? ''),
  orderId: row.orderId ? String(row.orderId) : null,
  metadataJson: row.metadataJson ? String(row.metadataJson) : null,
  createdAt: String(row.createdAt ?? ''),
});

const asUserSummary = (row: DbRow): UserSummary => ({
  id: String(row.id ?? ''),
  displayName: String(row.displayName ?? ''),
  role: String(row.role ?? 'employee') as UserSummary['role'],
  isActive: boolFromDb(row.isActive),
  createdAt: String(row.createdAt ?? ''),
  updatedAt: String(row.updatedAt ?? ''),
});

const asOrderItemRow = (row: DbRow): (OrderItem & { orderId: string }) => ({
  id: String(row.id ?? ''),
  orderId: String(row.orderId ?? ''),
  name: String(row.name ?? ''),
  image: row.image ? String(row.image) : undefined,
  price: Number(row.price ?? 0),
  quantity: Number(row.quantity ?? 0),
  lineTotal: Number(row.lineTotal ?? 0),
});

const asOrder = (row: DbRow, items: OrderItem[]): Order => ({
  id: String(row.id ?? ''),
  orderNumber: String(row.orderNumber ?? ''),
  customerName: String(row.customerName ?? ''),
  mobileNumber: String(row.mobileNumber ?? ''),
  province: String(row.province ?? ''),
  extraAddress: String(row.extraAddress ?? ''),
  note: String(row.note ?? ''),
  specialRequests: String(row.specialRequests ?? ''),
  items,
  subtotal: Number(row.subtotal ?? 0),
  total: Number(row.total ?? 0),
  status: String(row.status ?? 'pending_captain') as OrderStatus,
  createdByRole: String(row.createdByRole ?? 'employee') as Order['createdByRole'],
  createdByName: String(row.createdByName ?? ''),
  createdByUserId: row.createdByUserId ? String(row.createdByUserId) : null,
  createdAt: String(row.createdAt ?? ''),
  acceptedAt: row.acceptedAt ? String(row.acceptedAt) : null,
  completedAt: row.completedAt ? String(row.completedAt) : null,
  updatedAt: String(row.updatedAt ?? ''),
  cancelReason: String(row.cancelReason ?? ''),
});

const buildInClause = (count: number) => Array.from({ length: count }, () => '?').join(', ');
const SQL_VARIABLE_CHUNK_SIZE = 100;

const chunkValues = <T>(values: T[], size = SQL_VARIABLE_CHUNK_SIZE) => {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
};

const queryRowsByChunks = async (
  env: AppBindings,
  sqlFactory: (placeholders: string) => string,
  values: string[],
) => {
  const results: DbRow[] = [];
  for (const chunk of chunkValues(values)) {
    const rows = await env.DB.prepare(sqlFactory(buildInClause(chunk.length))).bind(...chunk).all<DbRow>();
    results.push(...(rows.results ?? []));
  }
  return results;
};

const countRowsByChunks = async (
  env: AppBindings,
  sqlFactory: (placeholders: string) => string,
  values: string[],
) => {
  let total = 0;
  for (const chunk of chunkValues(values)) {
    const row = await env.DB.prepare(sqlFactory(buildInClause(chunk.length))).bind(...chunk).first<{ count: number }>();
    total += Number(row?.count ?? 0);
  }
  return total;
};

const deleteRowsByIds = async (env: AppBindings, tableName: string, ids: string[]) => {
  for (const chunk of chunkValues(ids)) {
    await env.DB.prepare(`DELETE FROM ${tableName} WHERE id IN (${buildInClause(chunk.length)})`).bind(...chunk).run();
  }
};

const normalizeFileName = (value: string) => value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');

const getYesterdayDayKey = (timeZone = BUSINESS_TIME_ZONE) => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const today = formatter.format(now);
  const pivot = new Date(`${today}T12:00:00`);
  pivot.setDate(pivot.getDate() - 1);
  return formatter.format(pivot);
};

const getRangeBounds = (
  input: { rangeType: 'yesterday' | 'single_day' | 'custom_range'; date?: string; fromDate?: string; toDate?: string },
) => {
  if (input.rangeType === 'yesterday') {
    const day = getYesterdayDayKey();
    return { fromDate: day, toDate: day };
  }

  if (input.rangeType === 'single_day') {
    return { fromDate: input.date ?? '', toDate: input.date ?? '' };
  }

  return { fromDate: input.fromDate ?? '', toDate: input.toDate ?? '' };
};

const matchesRange = (createdAt: string, fromDate: string, toDate: string) => {
  const dayKey = getBusinessDayKey(createdAt);
  return dayKey >= fromDate && dayKey <= toDate;
};

const buildUpsertOrderCounterStatement = (env: AppBindings, nextValue: number, updatedAt: string) =>
  env.DB
    .prepare(
      `
      INSERT INTO order_counters (scope, next_value, updated_at)
      VALUES ('orders', ?, ?)
      ON CONFLICT(scope) DO UPDATE
      SET next_value = excluded.next_value, updated_at = excluded.updated_at
      `,
    )
    .bind(nextValue, updatedAt);

const allocateOrderSequence = async (env: AppBindings, timestamp: string) => {
  const counter = await env.DB
    .prepare(
      `
      UPDATE order_counters
      SET next_value = next_value + 1, updated_at = ?
      WHERE scope = 'orders'
      RETURNING next_value AS nextValue
      `,
    )
    .bind(timestamp)
    .first<{ nextValue: number }>();

  if (!counter) {
    const settings = await getAppSettings(env);
    await buildUpsertOrderCounterStatement(env, settings.orderSequence, timestamp).run();
    return allocateOrderSequence(env, timestamp);
  }

  return Number(counter.nextValue ?? 0);
};

const buildDailySeries = (orders: Order[]) =>
  Object.entries(
    orders.reduce<Record<string, { dayKey: string; orderCount: number; revenue: number }>>((groups, order) => {
      const dayKey = getBusinessDayKey(order.createdAt);
      const current = groups[dayKey] ?? {
        dayKey,
        orderCount: 0,
        revenue: 0,
      };

      groups[dayKey] = {
        dayKey,
        orderCount: current.orderCount + 1,
        revenue: current.revenue + (order.status === 'cancelled' ? 0 : order.total),
      };
      return groups;
    }, {}),
  )
    .map(([, value]) => value)
    .sort((left, right) => right.dayKey.localeCompare(left.dayKey));

const assertOrderStatusTransition = (currentStatus: OrderStatus, nextStatus: OrderStatus, actorRole: AuthUser['role']) => {
  if (currentStatus === nextStatus) {
    return;
  }

  if (actorRole === 'employee') {
    if (currentStatus !== 'pending_captain' || nextStatus !== 'cancelled') {
      throw new Error('کارمەند تەنها دەتوانێت داواکارییەکی چاوەڕێ هەڵبوەشێنێتەوە.');
    }

    return;
  }

  if (currentStatus === 'completed' || currentStatus === 'cancelled') {
    throw new Error('ناتوانرێت دۆخی داواکارییەکی کۆتایی پێگەیشتوو بگۆڕدرێت.');
  }

  if (nextStatus === 'pending_captain') {
    throw new Error('ناتوانرێت داواکاری بگەڕێندرێتەوە بۆ دۆخی چاوەڕێ.');
  }

  if (nextStatus === 'accepted' && currentStatus !== 'pending_captain') {
    throw new Error('تەنها داواکارییەکی چاوەڕێ دەتوانرێت قبوڵ بکرێت.');
  }

  if (nextStatus === 'completed' && currentStatus !== 'accepted') {
    throw new Error('تەنها داواکارییەکی قبوڵکراو دەتوانرێت تەواو بکرێت.');
  }

  if (nextStatus === 'cancelled' && !['pending_captain', 'accepted'].includes(currentStatus)) {
    throw new Error('تەنها داواکارییەکی چاوەڕێ یان قبوڵکراو دەتوانرێت هەڵبوەشێندرێتەوە.');
  }
};

const csvEscape = (value: string | number | null | undefined) => {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

const mapBackupMediaAsset = async (env: AppBindings, asset: MediaAsset) => {
  if (!asset.r2Key) {
    return asset;
  }

  const object = await env.MENU_ASSETS.get(asset.r2Key);
  if (!object) {
    return asset;
  }

  const buffer = await object.arrayBuffer();
  const dataUrl = arrayBufferToDataUrl(buffer, asset.mimeType);
  return {
    ...asset,
    originalDataUrl: dataUrl,
    previewDataUrl: dataUrl,
  };
};

export const ensureCoreData = async (env: AppBindings) => {
  const existingSettings = await env.DB.prepare('SELECT id FROM settings WHERE id = ? LIMIT 1').bind('app').first<{ id: string }>();
  if (!existingSettings) {
    const timestamp = nowIso();
    const settings = buildDefaultSettings(timestamp);
    await env.DB
      .prepare(
        `
        INSERT INTO settings (
          id, business_name, province_options_json, order_sequence, seeded_at, last_reset_at, support_note,
          delivery_mobile_block_enabled, hidden_category_ids_json, hidden_menu_item_ids_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .bind(
        'app',
        settings.businessName,
        JSON.stringify(settings.provinceOptions),
        settings.orderSequence,
        settings.seededAt,
        settings.lastResetAt,
        settings.supportNote,
        settings.deliveryMobileBlockEnabled ? 1 : 0,
        JSON.stringify(settings.hiddenCategoryIds),
        JSON.stringify(settings.hiddenMenuItemIds),
        settings.updatedAt,
      )
      .run();
  }

  const settingsRow = await env.DB
    .prepare('SELECT order_sequence AS orderSequence, updated_at AS updatedAt FROM settings WHERE id = ? LIMIT 1')
    .bind('app')
    .first<{ orderSequence: number; updatedAt: string }>();

  if (settingsRow) {
    await buildUpsertOrderCounterStatement(
      env,
      Number(settingsRow.orderSequence ?? 0),
      String(settingsRow.updatedAt ?? nowIso()),
    ).run();
  }

  for (const user of DEFAULT_USERS) {
    const timestamp = nowIso();
    await env.DB
      .prepare(
        `
        INSERT INTO users (id, display_name, role, pin_hash, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, 1, ?, ?)
        ON CONFLICT(id) DO UPDATE
        SET display_name = excluded.display_name,
            role = excluded.role,
            pin_hash = excluded.pin_hash,
            is_active = 1,
            updated_at = excluded.updated_at
        `,
      )
      .bind(user.id, user.displayName, user.role, await hashPin(user.pin, env.PIN_PEPPER), timestamp, timestamp)
      .run();
  }
};

export const getAppSettings = async (env: AppBindings) => {
  await ensureCoreData(env);
  const row = await env.DB.prepare(SETTINGS_SELECT_SQL).first<DbRow>();
  if (!row) {
    throw new Error('ڕێکخستنەکان نەدۆزرایەوە.');
  }

  return asSettings(row);
};

export const updateBusinessSettings = async (
  env: AppBindings,
  input: Pick<AppSettings, 'businessName' | 'provinceOptions' | 'supportNote' | 'deliveryMobileBlockEnabled'>,
  actor: Actor,
) => {
  const current = await getAppSettings(env);
  const updated: AppSettings = {
    ...current,
    businessName: input.businessName,
    provinceOptions: Array.from(new Set(input.provinceOptions)),
    supportNote: input.supportNote,
    deliveryMobileBlockEnabled: input.deliveryMobileBlockEnabled,
    updatedAt: nowIso(),
  };

  await env.DB
    .prepare(
      `
      UPDATE settings
      SET business_name = ?, province_options_json = ?, support_note = ?, delivery_mobile_block_enabled = ?, updated_at = ?
      WHERE id = 'app'
      `,
    )
    .bind(
      updated.businessName,
      JSON.stringify(updated.provinceOptions),
      updated.supportNote,
      updated.deliveryMobileBlockEnabled ? 1 : 0,
      updated.updatedAt,
    )
    .run();

  await addActivityLog(env, {
    type: 'settings_updated',
    message: 'ڕێکخستنەکانی business نوێکرانەوە.',
    actor,
  });

  return updated;
};

export const setCatalogVisibility = async (
  env: AppBindings,
  input: { entityType: 'category' | 'menuItem'; entityId: string; isVisible: boolean },
  actor: Actor,
) => {
  const current = await getAppSettings(env);
  const key = input.entityType === 'category' ? 'hiddenCategoryIds' : 'hiddenMenuItemIds';
  const nextIds = input.isVisible
    ? current[key].filter((id) => id !== input.entityId)
    : [...new Set([...current[key], input.entityId])];

  const updated: AppSettings = {
    ...current,
    [key]: nextIds,
    updatedAt: nowIso(),
  };

  await env.DB
    .prepare(
      `
      UPDATE settings
      SET hidden_category_ids_json = ?, hidden_menu_item_ids_json = ?, updated_at = ?
      WHERE id = 'app'
      `,
    )
    .bind(
      JSON.stringify(updated.hiddenCategoryIds),
      JSON.stringify(updated.hiddenMenuItemIds),
      updated.updatedAt,
    )
    .run();

  await addActivityLog(env, {
    type: 'settings_visibility',
    message: `${input.entityType === 'category' ? 'پۆل' : 'خواردن'} ${input.isVisible ? 'چالاککرا' : 'شاراوەکرا'}: ${input.entityId}`,
    actor,
  });

  return updated;
};

export const listCategories = async (env: AppBindings) => {
  await ensureCoreData(env);
  const rows = await env.DB.prepare(CATEGORY_SELECT_SQL).all<DbRow>();
  return (rows.results ?? []).map(asCategory);
};

export const saveCategory = async (
  env: AppBindings,
  input: { id?: string; name: string; sortOrder: number },
  actor: Actor,
) => {
  const now = nowIso();
  const existing = input.id
    ? await env.DB.prepare('SELECT id FROM categories WHERE id = ? LIMIT 1').bind(input.id).first<{ id: string }>()
    : null;
  const id = input.id ?? crypto.randomUUID();

  if (existing) {
    await env.DB
      .prepare('UPDATE categories SET name = ?, sort_order = ?, updated_at = ? WHERE id = ?')
      .bind(input.name, input.sortOrder, now, id)
      .run();
  } else {
    await env.DB
      .prepare('INSERT INTO categories (id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .bind(id, input.name, input.sortOrder, now, now)
      .run();
  }

  await addActivityLog(env, {
    type: existing ? 'category_updated' : 'category_created',
    message: `${existing ? 'پۆلێک نوێکرایەوە' : 'پۆلێکی نوێ زیادکرا'}: ${input.name}`,
    actor,
  });

  const saved = await env.DB
    .prepare(
      `
      SELECT id, name, sort_order AS sortOrder, created_at AS createdAt, updated_at AS updatedAt
      FROM categories
      WHERE id = ?
      LIMIT 1
      `,
    )
    .bind(id)
    .first<DbRow>();

  return saved ? asCategory(saved) : null;
};

export const deleteCategory = async (env: AppBindings, categoryId: string, actor: Actor) => {
  const category = await env.DB.prepare('SELECT name FROM categories WHERE id = ? LIMIT 1').bind(categoryId).first<{ name: string }>();
  if (!category) {
    return false;
  }

  const linkedItems = await env.DB.prepare('SELECT COUNT(*) AS count FROM menu_items WHERE category_id = ?').bind(categoryId).first<{ count: number }>();
  if (Number(linkedItems?.count ?? 0) > 0) {
    throw new Error('پێش سڕینەوەی پۆلەکە، خواردنەکان لێی بگوازەوە یان بسڕەوە.');
  }

  await env.DB.prepare('DELETE FROM categories WHERE id = ?').bind(categoryId).run();
  await addActivityLog(env, {
    type: 'category_deleted',
    message: `پۆل سڕایەوە: ${category.name}`,
    actor,
  });

  return true;
};

export const listMenuItems = async (env: AppBindings) => {
  await ensureCoreData(env);
  const rows = await env.DB.prepare(MENU_ITEM_SELECT_SQL).all<DbRow>();
  return (rows.results ?? []).map(asMenuItem);
};

export const getMenuItemById = async (env: AppBindings, menuItemId: string) => {
  const row = await env.DB
    .prepare(
      `
      SELECT
        id,
        category_id AS categoryId,
        name,
        description,
        price,
        image,
        image_asset_id AS imageAssetId,
        is_available AS isAvailable,
        sort_order AS sortOrder,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM menu_items
      WHERE id = ?
      LIMIT 1
      `,
    )
    .bind(menuItemId)
    .first<DbRow>();
  return row ? asMenuItem(row) : null;
};

export const saveMenuItem = async (
  env: AppBindings,
  input: {
    id?: string;
    categoryId: string;
    name: string;
    description: string;
    price: number;
    image: string;
    imageAssetId?: string | null;
    isAvailable: boolean;
    sortOrder: number;
  },
  actor: Actor,
) => {
  const category = await env.DB.prepare('SELECT id FROM categories WHERE id = ? LIMIT 1').bind(input.categoryId).first<{ id: string }>();
  if (!category) {
    throw new Error('پۆلی دیاریکراو نەدۆزرایەوە.');
  }

  const now = nowIso();
  const id = input.id ?? crypto.randomUUID();
  const existing = input.id
    ? await env.DB.prepare('SELECT id FROM menu_items WHERE id = ? LIMIT 1').bind(input.id).first<{ id: string }>()
    : null;

  if (existing) {
    await env.DB
      .prepare(
        `
        UPDATE menu_items
        SET category_id = ?, name = ?, description = ?, price = ?, image = ?, image_asset_id = ?, is_available = ?, sort_order = ?, updated_at = ?
        WHERE id = ?
        `,
      )
      .bind(
        input.categoryId,
        input.name,
        input.description,
        input.price,
        input.image,
        input.imageAssetId ?? null,
        input.isAvailable ? 1 : 0,
        input.sortOrder,
        now,
        id,
      )
      .run();
  } else {
    await env.DB
      .prepare(
        `
        INSERT INTO menu_items (
          id, category_id, name, description, price, image, image_asset_id, is_available, sort_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .bind(
        id,
        input.categoryId,
        input.name,
        input.description,
        input.price,
        input.image,
        input.imageAssetId ?? null,
        input.isAvailable ? 1 : 0,
        input.sortOrder,
        now,
        now,
      )
      .run();
  }

  await addActivityLog(env, {
    type: existing ? 'menu_updated' : 'menu_created',
    message: `${existing ? 'خواردنێک نوێکرایەوە' : 'خواردنێکی نوێ زیادکرا'}: ${input.name}`,
    actor,
  });

  return getMenuItemById(env, id);
};

export const deleteMenuItem = async (env: AppBindings, menuItemId: string, actor: Actor) => {
  const item = await env.DB
    .prepare('SELECT name, image_asset_id AS imageAssetId FROM menu_items WHERE id = ? LIMIT 1')
    .bind(menuItemId)
    .first<{ name: string; imageAssetId: string | null }>();
  if (!item) {
    return false;
  }

  await env.DB.prepare('DELETE FROM menu_items WHERE id = ?').bind(menuItemId).run();

  if (item.imageAssetId) {
    const usage = await env.DB
      .prepare('SELECT COUNT(*) AS count FROM menu_items WHERE image_asset_id = ?')
      .bind(item.imageAssetId)
      .first<{ count: number }>();
    if (Number(usage?.count ?? 0) === 0) {
      const asset = await env.DB
        .prepare('SELECT r2_key AS r2Key FROM media_assets WHERE id = ? LIMIT 1')
        .bind(item.imageAssetId)
        .first<{ r2Key: string }>();
      await env.DB.prepare('DELETE FROM media_assets WHERE id = ?').bind(item.imageAssetId).run();
      if (asset?.r2Key) {
        await env.MENU_ASSETS.delete(asset.r2Key);
      }
    }
  }

  await addActivityLog(env, {
    type: 'menu_deleted',
    message: `خواردن سڕایەوە: ${item.name}`,
    actor,
  });

  return true;
};

export const setMenuAvailability = async (
  env: AppBindings,
  menuItemId: string,
  isAvailable: boolean,
  actor: Actor,
) => {
  const item = await env.DB.prepare('SELECT name FROM menu_items WHERE id = ? LIMIT 1').bind(menuItemId).first<{ name: string }>();
  if (!item) {
    return null;
  }

  await env.DB
    .prepare('UPDATE menu_items SET is_available = ?, updated_at = ? WHERE id = ?')
    .bind(isAvailable ? 1 : 0, nowIso(), menuItemId)
    .run();

  await addActivityLog(env, {
    type: 'menu_availability',
    message: `${isAvailable ? 'خواردن چالاککرا' : 'خواردن ناچالاککرا'}: ${item.name}`,
    actor,
  });

  return getMenuItemById(env, menuItemId);
};

export const uploadMediaAsset = async (
  env: AppBindings,
  file: File,
  meta: { width: number; height: number },
  actor: Actor,
) => {
  const assetId = crypto.randomUUID();
  const fileName = file.name || `menu-image-${assetId}.jpg`;
  const r2Key = `menu/${assetId}-${normalizeFileName(fileName)}`;
  await env.MENU_ASSETS.put(r2Key, await file.arrayBuffer(), {
    httpMetadata: {
      contentType: file.type || 'application/octet-stream',
    },
  });

  const timestamp = nowIso();
  const publicUrl = `/media/${assetId}`;
  await env.DB
    .prepare(
      `
      INSERT INTO media_assets (
        id, kind, file_name, mime_type, byte_size, width, height, original_data_url, preview_data_url, r2_key, created_at, updated_at
      ) VALUES (?, 'menu-image', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .bind(
      assetId,
      fileName,
      file.type || 'application/octet-stream',
      file.size,
      meta.width,
      meta.height,
      publicUrl,
      publicUrl,
      r2Key,
      timestamp,
      timestamp,
    )
    .run();

  await addActivityLog(env, {
    type: 'media_uploaded',
    message: `وێنەی خواردن هەڵگیرا: ${fileName}`,
    actor,
  });

  return getMediaAssetById(env, assetId);
};

export const getMediaAssetById = async (env: AppBindings, assetId: string) => {
  const row = await env.DB
    .prepare(
      `
      SELECT
        id,
        kind,
        file_name AS fileName,
        mime_type AS mimeType,
        byte_size AS byteSize,
        width,
        height,
        original_data_url AS originalDataUrl,
        preview_data_url AS previewDataUrl,
        r2_key AS r2Key,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM media_assets
      WHERE id = ?
      LIMIT 1
      `,
    )
    .bind(assetId)
    .first<DbRow>();
  return row ? asMediaAsset(row) : null;
};

export const getMediaObject = async (env: AppBindings, assetId: string) => {
  const asset = await getMediaAssetById(env, assetId);
  if (!asset?.r2Key) {
    return null;
  }

  const object = await env.MENU_ASSETS.get(asset.r2Key);
  if (!object) {
    return null;
  }

  return { asset, object };
};

export const listMediaAssets = async (env: AppBindings) => {
  await ensureCoreData(env);
  const rows = await env.DB.prepare(MEDIA_SELECT_SQL).all<DbRow>();
  return (rows.results ?? []).map(asMediaAsset);
};

export const listMediaUsage = async (env: AppBindings) => {
  const [assets, items] = await Promise.all([listMediaAssets(env), listMenuItems(env)]);
  return assets.map((asset) => {
    const linkedItems = items.filter((item) => item.imageAssetId === asset.id);
    return {
      asset,
      linkedItems,
      usageCount: linkedItems.length,
    };
  });
};

export const detachMediaAsset = async (env: AppBindings, assetId: string, actor: Actor) => {
  const asset = await getMediaAssetById(env, assetId);
  if (!asset) {
    return null;
  }

  const linkedItems = (await listMenuItems(env)).filter((item) => item.imageAssetId === assetId);
  await env.DB.prepare('UPDATE menu_items SET image_asset_id = NULL, image = ?, updated_at = ? WHERE image_asset_id = ?').bind('🍽️', nowIso(), assetId).run();
  await env.DB.prepare('DELETE FROM media_assets WHERE id = ?').bind(assetId).run();
  if (asset.r2Key) {
    await env.MENU_ASSETS.delete(asset.r2Key);
  }

  await addActivityLog(env, {
    type: 'media_deleted',
    message: `وێنەی هەڵگیراو سڕایەوە: ${asset.fileName}`,
    actor,
  });

  return { asset, linkedItems };
};

export const listOrders = async (
  env: AppBindings,
  options?: { creatorName?: string; creatorUserId?: string | null },
) => {
  await ensureCoreData(env);
  const filters: string[] = [];
  const values: Array<string | null> = [];

  if (options?.creatorUserId) {
    filters.push('created_by_user_id = ?');
    values.push(options.creatorUserId);
  } else if (options?.creatorName) {
    filters.push('created_by_name = ?');
    values.push(options.creatorName);
  }

  const whereClause = filters.length > 0 ? ` WHERE ${filters.join(' AND ')}` : '';
  const rows = await env.DB.prepare(`${ORDER_SELECT_SQL}${whereClause} ORDER BY created_at DESC`).bind(...values).all<DbRow>();
  const orderRows = rows.results ?? [];
  if (orderRows.length === 0) {
    return [];
  }

  const orderIds = orderRows.map((row) => String(row.id));
  const itemRows = await queryRowsByChunks(
    env,
    (placeholders) => `
      SELECT
        id,
        order_id AS orderId,
        name,
        image,
        price,
        quantity,
        line_total AS lineTotal
      FROM order_items
      WHERE order_id IN (${placeholders})
      ORDER BY rowid ASC
      `,
    orderIds,
  );

  const itemsByOrderId = itemRows.map(asOrderItemRow).reduce<Record<string, OrderItem[]>>((groups, item) => {
    groups[item.orderId] = [...(groups[item.orderId] ?? []), {
      id: item.id,
      name: item.name,
      image: item.image,
      price: item.price,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    }];
    return groups;
  }, {});

  return orderRows.map((row) => asOrder(row, itemsByOrderId[String(row.id)] ?? []));
};

export const getOrderById = async (env: AppBindings, orderId: string) => {
  const orders = await listOrders(env);
  return orders.find((order) => order.id === orderId) ?? null;
};

export const createOrder = async (
  env: AppBindings,
  input: {
    customerName: string;
    mobileNumber: string;
    province: string;
    extraAddress: string;
    note: string;
    specialRequests: string;
    items: OrderItem[];
    subtotal: number;
    total: number;
    clientCreatedAt?: string;
  },
  authUser: AuthUser,
) => {
  const settings = await getAppSettings(env);
  const hiddenItemIds = new Set(settings.hiddenMenuItemIds);
  const hiddenCategoryIds = new Set(settings.hiddenCategoryIds);
  const sourceItems = await listMenuItems(env);
  const sourceMap = new Map(sourceItems.map((item) => [item.id, item]));
  const sanitizedItems = input.items.map((item) => {
    const source = sourceMap.get(item.id);
    if (!source || !source.isAvailable || hiddenItemIds.has(item.id) || hiddenCategoryIds.has(source.categoryId)) {
      throw new Error('هەندێک لە بابەتەکانی سەبەت بەردەست نین.');
    }

    return {
      id: item.id,
      name: source.name,
      image: source.image,
      price: source.price,
      quantity: item.quantity,
      lineTotal: source.price * item.quantity,
    } satisfies OrderItem;
  });

  const subtotal = sanitizedItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const total = subtotal;
  const createdAt = input.clientCreatedAt && !Number.isNaN(Date.parse(input.clientCreatedAt))
    ? new Date(input.clientCreatedAt).toISOString()
    : nowIso();
  const persistedAt = nowIso();
  const orderId = crypto.randomUUID();
  const nextSequence = await allocateOrderSequence(env, persistedAt);
  const orderNumber = `ORD-${String(nextSequence).padStart(4, '0')}`;
  const statements: D1PreparedStatement[] = [
    env.DB
      .prepare(
        `
        UPDATE settings
        SET order_sequence = ?, updated_at = ?
        WHERE id = 'app'
        `,
      )
      .bind(nextSequence, persistedAt),
    env.DB
      .prepare(
        `
        INSERT INTO orders (
          id, order_number, customer_name, mobile_number, province, extra_address, note, special_requests,
          subtotal, total, status, created_by_role, created_by_name, created_by_user_id, created_at, accepted_at,
          completed_at, updated_at, cancel_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_captain', ?, ?, ?, ?, NULL, NULL, ?, '')
        `,
      )
      .bind(
        orderId,
        orderNumber,
        input.customerName,
        input.mobileNumber,
        input.province,
        input.extraAddress,
        input.note,
        input.specialRequests,
        subtotal,
        total,
        authUser.role,
        authUser.displayName,
        authUser.userId,
        createdAt,
        persistedAt,
      ),
    ...sanitizedItems.map((item) =>
      env.DB
        .prepare(
          `
          INSERT INTO order_items (id, order_id, name, image, price, quantity, line_total)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
        )
        .bind(crypto.randomUUID(), orderId, item.name, item.image ?? null, item.price, item.quantity, item.lineTotal),
    ),
    env.DB
      .prepare(
        `
        INSERT INTO notifications (
          id, target_role, target_display_name, order_id, order_number, title, message, is_read, created_at
        ) VALUES (?, 'captain', NULL, ?, ?, ?, ?, 0, ?)
        `,
      )
      .bind(
        crypto.randomUUID(),
        orderId,
        orderNumber,
        `ئۆردەرێکی نوێ هات: ${orderNumber}`,
        `${authUser.displayName} داواکارییەکی نوێ نارد.`,
        persistedAt,
      ),
    env.DB
      .prepare(
        `
        INSERT INTO activity_logs (id, type, message, actor_role, actor_name, order_id, metadata_json, created_at)
        VALUES (?, 'order_created', ?, ?, ?, ?, NULL, ?)
        `,
      )
      .bind(
        crypto.randomUUID(),
        `داواکارییەکی نوێ نێردرا: ${orderNumber}`,
        authUser.role,
        authUser.displayName,
        orderId,
        persistedAt,
      ),
  ];

  await env.DB.batch(statements);

  const order = await getOrderById(env, orderId);
  if (!order) {
    throw new Error('ناتوانرێت داواکارییەکە بدۆزرێتەوە.');
  }

  return order;
};

export const updateOrderStatus = async (
  env: AppBindings,
  orderId: string,
  status: OrderStatus,
  actor: AuthUser,
  cancelReason = '',
) => {
  const existing = await getOrderById(env, orderId);
  if (!existing) {
    throw new Error('داواکاری نەدۆزرایەوە.');
  }

  assertOrderStatusTransition(existing.status, status, actor.role);

  const timestamp = nowIso();
  const acceptedAt = status === 'accepted' ? timestamp : existing.acceptedAt;
  const completedAt = status === 'completed' ? timestamp : existing.completedAt;

  await env.DB
    .prepare(
      `
      UPDATE orders
      SET status = ?, accepted_at = ?, completed_at = ?, updated_at = ?, cancel_reason = ?
      WHERE id = ?
      `,
    )
    .bind(status, acceptedAt, completedAt, timestamp, status === 'cancelled' ? cancelReason : '', orderId)
    .run();

  const messages: Record<OrderStatus, string> = {
    pending_captain: `داواکاری هێشتا چاوەڕێی کاپتنە: ${existing.orderNumber}`,
    accepted: `کاپتن داواکاری وەرگرت: ${existing.orderNumber}`,
    completed: `داواکاری تەواوبوو: ${existing.orderNumber}`,
    cancelled: `داواکاری هەڵوەشایەوە: ${existing.orderNumber}`,
  };

  await addActivityLog(env, {
    type: `order_${status}`,
    message: messages[status],
    actor: { role: actor.role, displayName: actor.displayName },
    orderId,
  });

  if (status === 'accepted' || status === 'completed' || status === 'cancelled') {
    await env.DB
      .prepare(
        `
        INSERT INTO notifications (
          id, target_role, target_display_name, order_id, order_number, title, message, is_read, created_at
        ) VALUES (?, 'employee', ?, ?, ?, ?, ?, 0, ?)
        `,
      )
      .bind(
        crypto.randomUUID(),
        existing.createdByName,
        existing.id,
        existing.orderNumber,
        status === 'cancelled'
          ? `ئۆردەرەکەت هەڵوەشایەوە: ${existing.orderNumber}`
          : status === 'completed'
            ? `ئۆردەرەکەت تەواوبوو: ${existing.orderNumber}`
            : `ئۆردەرەکەت قبوڵ کرا: ${existing.orderNumber}`,
        status === 'cancelled'
          ? cancelReason || `داواکاریی ${existing.orderNumber} هەڵوەشایەوە.`
          : status === 'completed'
            ? `داواکاریی ${existing.orderNumber} تەواوبوو.`
            : `کاپتن داواکاریی ${existing.orderNumber} قبوڵ کرد.`,
        timestamp,
      )
      .run();
  }

  return getOrderById(env, orderId);
};

export const listNotificationsForUser = async (env: AppBindings, authUser: AuthUser) => {
  const rows = await env.DB
    .prepare(
      `${NOTIFICATION_SELECT_SQL}
       WHERE target_role = ?
       AND (target_display_name IS NULL OR target_display_name = ?)
       ORDER BY created_at DESC`,
    )
    .bind(authUser.role, authUser.displayName)
    .all<DbRow>();
  return (rows.results ?? []).map(asNotification);
};

export const listAllNotifications = async (env: AppBindings) => {
  const rows = await env.DB.prepare(`${NOTIFICATION_SELECT_SQL} ORDER BY created_at DESC`).all<DbRow>();
  return (rows.results ?? []).map(asNotification);
};

export const markNotificationsReadForUser = async (env: AppBindings, authUser: AuthUser) => {
  await env.DB
    .prepare(
      `
      UPDATE notifications
      SET is_read = 1
      WHERE target_role = ?
      AND (target_display_name IS NULL OR target_display_name = ?)
      `,
    )
    .bind(authUser.role, authUser.displayName)
    .run();
  return true;
};

export const clearAllNotifications = async (env: AppBindings, actor: Actor) => {
  await env.DB.prepare('DELETE FROM notifications').run();
  await addActivityLog(env, {
    type: 'notifications_cleared',
    message: 'هەموو ئاگەدارکردنەوەکان لەلایەن ئادمین پاککرانەوە.',
    actor,
  });
  return true;
};

export const listActivityLogs = async (env: AppBindings, limit?: number) => {
  const sql = `${ACTIVITY_SELECT_SQL} ORDER BY created_at DESC${typeof limit === 'number' ? ' LIMIT ?' : ''}`;
  const statement = env.DB.prepare(sql);
  const rows = typeof limit === 'number' ? await statement.bind(limit).all<DbRow>() : await statement.all<DbRow>();
  return (rows.results ?? []).map(asActivityLog);
};

export const listUsers = async (env: AppBindings) => {
  const rows = await env.DB
    .prepare(
      `
      SELECT
        id,
        display_name AS displayName,
        role,
        is_active AS isActive,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM users
      ORDER BY role ASC, display_name COLLATE NOCASE ASC
      `,
    )
    .all<DbRow>();
  return (rows.results ?? []).map(asUserSummary);
};

export const getEmployeeActivityAnalytics = async (env: AppBindings) => {
  const [users, orders] = await Promise.all([listUsers(env), listOrders(env)]);
  return buildEmployeeActivityReport(users, orders);
};

export const getReportsSummary = async (env: AppBindings): Promise<ReportsSummaryDto> => {
  const [orders, menuItems, categories, notifications, employeeActivity] = await Promise.all([
    listOrders(env),
    listMenuItems(env),
    listCategories(env),
    listAllNotifications(env),
    getEmployeeActivityAnalytics(env),
  ]);

  const revenue = orders.filter((order) => order.status !== 'cancelled').reduce((sum, order) => sum + order.total, 0);
  return {
    totals: {
      orders: orders.length,
      revenue,
      pending: orders.filter((order) => order.status === 'pending_captain').length,
      completed: orders.filter((order) => order.status === 'completed').length,
      cancelled: orders.filter((order) => order.status === 'cancelled').length,
      menuItems: menuItems.length,
      availableMenuItems: menuItems.filter((item) => item.isAvailable).length,
      unavailableMenuItems: menuItems.filter((item) => !item.isAvailable).length,
      categories: categories.length,
      notifications: notifications.length,
    },
    businessTimeZone: BUSINESS_TIME_ZONE,
    generatedAt: nowIso(),
    dailySeries: buildDailySeries(orders),
    employeeActivity,
  };
};

export const prepareBlankSystem = async (env: AppBindings, actor: Actor) => {
  const media = await listMediaAssets(env);
  for (const asset of media) {
    if (asset.r2Key) {
      await env.MENU_ASSETS.delete(asset.r2Key);
    }
  }

  const settings = buildDefaultSettings(nowIso());
  await env.DB.batch([
    env.DB.prepare('DELETE FROM order_items'),
    env.DB.prepare('DELETE FROM notifications'),
    env.DB.prepare('DELETE FROM activity_logs'),
    env.DB.prepare('DELETE FROM orders'),
    env.DB.prepare('DELETE FROM menu_items'),
    env.DB.prepare('DELETE FROM categories'),
    env.DB.prepare('DELETE FROM media_assets'),
    env.DB
      .prepare(
        `
        UPDATE settings
        SET business_name = ?, province_options_json = ?, order_sequence = 0, seeded_at = ?, last_reset_at = ?,
            support_note = ?, delivery_mobile_block_enabled = ?, hidden_category_ids_json = ?, hidden_menu_item_ids_json = ?, updated_at = ?
        WHERE id = 'app'
        `,
      )
      .bind(
        settings.businessName,
        JSON.stringify(settings.provinceOptions),
        settings.seededAt,
        settings.lastResetAt,
        settings.supportNote,
        settings.deliveryMobileBlockEnabled ? 1 : 0,
        JSON.stringify([]),
        JSON.stringify([]),
        settings.updatedAt,
      ),
    buildUpsertOrderCounterStatement(env, 0, settings.updatedAt),
  ]);

  await addActivityLog(env, {
    type: 'prepare_blank',
    message: 'سیستەم لەلایەن ئادمین بۆ کارکردنی ڕاستەقینە بەتاڵ و ئامادە کرا.',
    actor,
  });

  return getAppSettings(env);
};

export const previewDeleteOrders = async (
  env: AppBindings,
  input: { rangeType: 'yesterday' | 'single_day' | 'custom_range'; date?: string; fromDate?: string; toDate?: string },
) => {
  const { fromDate, toDate } = getRangeBounds(input);
  const orders = await listOrders(env);
  const affectedOrders = orders.filter((order) => matchesRange(order.createdAt, fromDate, toDate));
  const orderIds = affectedOrders.map((order) => order.id);
  let notificationCount = 0;
  let activityLogCount = 0;

  if (orderIds.length > 0) {
    notificationCount = await countRowsByChunks(env, (placeholders) => `SELECT COUNT(*) AS count FROM notifications WHERE order_id IN (${placeholders})`, orderIds);
    activityLogCount = await countRowsByChunks(env, (placeholders) => `SELECT COUNT(*) AS count FROM activity_logs WHERE order_id IN (${placeholders})`, orderIds);
  }

  return {
    rangeType: input.rangeType,
    roles: ['employee', 'captain', 'admin'] satisfies UserRole[],
    fromDate,
    toDate,
    includeTravelOrders: true,
    includeDeliveryOrders: false,
    includeTravelNotifications: true,
    includeDeliveryNotifications: false,
    includeActivityLogs: false,
    travelOrders: affectedOrders.length,
    deliveryOrders: 0,
    travelNotifications: notificationCount,
    deliveryNotifications: 0,
    totalRecords: affectedOrders.length + notificationCount,
    activityLogCount,
    totalSalesImpact: affectedOrders.reduce((sum, order) => sum + order.total, 0),
  } satisfies DeleteOrdersPreviewDto;
};

export const executeDeleteOrders = async (
  env: AppBindings,
  input: { rangeType: 'yesterday' | 'single_day' | 'custom_range'; date?: string; fromDate?: string; toDate?: string },
  actor: Actor,
) => {
  const preview = await previewDeleteOrders(env, input);
  if (preview.travelOrders === 0) {
    return preview;
  }

  const orders = await listOrders(env);
  const orderIds = orders
    .filter((order) => matchesRange(order.createdAt, preview.fromDate, preview.toDate))
    .map((order) => order.id);

  await deleteRowsByIds(env, 'orders', orderIds);
  await addActivityLog(env, {
    type: 'orders_deleted_by_range',
    message: `ئادمین ${preview.travelOrders} داواکاریی سڕییەوە لە نێوان ${preview.fromDate} تا ${preview.toDate}.`,
    actor,
  });
  return preview;
};

export const exportOrdersCsv = async (env: AppBindings) => {
  const orders = await listOrders(env);
  const rows = [
    ['orderNumber', 'customerName', 'mobileNumber', 'province', 'status', 'createdByName', 'createdAt', 'total'].join(','),
    ...orders.map((order) =>
      [
        csvEscape(order.orderNumber),
        csvEscape(order.customerName),
        csvEscape(order.mobileNumber),
        csvEscape(order.province),
        csvEscape(order.status),
        csvEscape(order.createdByName),
        csvEscape(order.createdAt),
        csvEscape(order.total),
      ].join(','),
    ),
  ];
  return rows.join('\n');
};

export const exportBackup = async (env: AppBindings): Promise<BackupPayload> => {
  const [settings, categories, menuItems, mediaAssets, orders, activityLogs, notifications] = await Promise.all([
    getAppSettings(env),
    listCategories(env),
    listMenuItems(env),
    listMediaAssets(env),
    listOrders(env),
    listActivityLogs(env),
    listAllNotifications(env),
  ]);

  const mediaWithData = await Promise.all(mediaAssets.map((asset) => mapBackupMediaAsset(env, asset)));
  return {
    exportedAt: nowIso(),
    settings,
    categories,
    menuItems,
    mediaAssets: mediaWithData,
    orders,
    deliveryOrders: [],
    activityLogs,
    notifications,
    deliveryNotifications: [],
  };
};

export const importBackup = async (env: AppBindings, payload: BackupPayload, actor: Actor) => {
  const existingMedia = await listMediaAssets(env);
  for (const asset of existingMedia) {
    if (asset.r2Key) {
      await env.MENU_ASSETS.delete(asset.r2Key);
    }
  }

  const statements: D1PreparedStatement[] = [
    env.DB.prepare('DELETE FROM order_items'),
    env.DB.prepare('DELETE FROM notifications'),
    env.DB.prepare('DELETE FROM activity_logs'),
    env.DB.prepare('DELETE FROM orders'),
    env.DB.prepare('DELETE FROM menu_items'),
    env.DB.prepare('DELETE FROM categories'),
    env.DB.prepare('DELETE FROM media_assets'),
    env.DB
      .prepare(
        `
        UPDATE settings
        SET business_name = ?, province_options_json = ?, order_sequence = ?, seeded_at = ?, last_reset_at = ?,
            support_note = ?, delivery_mobile_block_enabled = ?, hidden_category_ids_json = ?, hidden_menu_item_ids_json = ?, updated_at = ?
        WHERE id = 'app'
        `,
      )
      .bind(
        payload.settings.businessName,
        JSON.stringify(payload.settings.provinceOptions),
        payload.settings.orderSequence,
        payload.settings.seededAt,
        payload.settings.lastResetAt,
        payload.settings.supportNote,
        payload.settings.deliveryMobileBlockEnabled === false ? 0 : 1,
        JSON.stringify(payload.settings.hiddenCategoryIds),
        JSON.stringify(payload.settings.hiddenMenuItemIds),
        payload.settings.updatedAt,
      ),
    buildUpsertOrderCounterStatement(env, payload.settings.orderSequence, payload.settings.updatedAt),
  ];

  for (const category of payload.categories) {
    statements.push(
      env.DB
        .prepare('INSERT INTO categories (id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .bind(category.id, category.name, category.sortOrder, category.createdAt, category.updatedAt),
    );
  }

  for (const asset of payload.mediaAssets) {
    let finalAsset = asset;
    if (asset.originalDataUrl.startsWith('data:')) {
      const decoded = dataUrlToBytes(asset.originalDataUrl);
      const r2Key = asset.r2Key || `menu/${asset.id}-${normalizeFileName(asset.fileName)}`;
      await env.MENU_ASSETS.put(r2Key, decoded.bytes, {
        httpMetadata: {
          contentType: decoded.mimeType,
        },
      });
      finalAsset = {
        ...asset,
        mimeType: decoded.mimeType,
        r2Key,
        originalDataUrl: `/media/${asset.id}`,
        previewDataUrl: `/media/${asset.id}`,
      };
    }

    statements.push(
      env.DB
        .prepare(
          `
          INSERT INTO media_assets (
            id, kind, file_name, mime_type, byte_size, width, height, original_data_url, preview_data_url, r2_key, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
        )
        .bind(
          finalAsset.id,
          finalAsset.kind,
          finalAsset.fileName,
          finalAsset.mimeType,
          finalAsset.byteSize,
          finalAsset.width,
          finalAsset.height,
          finalAsset.originalDataUrl,
          finalAsset.previewDataUrl,
          finalAsset.r2Key ?? `menu/${finalAsset.id}-${normalizeFileName(finalAsset.fileName)}`,
          finalAsset.createdAt,
          finalAsset.updatedAt,
        ),
    );
  }

  for (const item of payload.menuItems) {
    statements.push(
      env.DB
        .prepare(
          `
          INSERT INTO menu_items (
            id, category_id, name, description, price, image, image_asset_id, is_available, sort_order, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
        )
        .bind(
          item.id,
          item.categoryId,
          item.name,
          item.description,
          item.price,
          item.image,
          item.imageAssetId ?? null,
          item.isAvailable ? 1 : 0,
          item.sortOrder,
          item.createdAt,
          item.updatedAt,
        ),
    );
  }

  for (const order of payload.orders) {
    statements.push(
      env.DB
        .prepare(
          `
          INSERT INTO orders (
            id, order_number, customer_name, mobile_number, province, extra_address, note, special_requests,
            subtotal, total, status, created_by_role, created_by_name, created_by_user_id, created_at,
            accepted_at, completed_at, updated_at, cancel_reason
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
        )
        .bind(
          order.id,
          order.orderNumber,
          order.customerName,
          order.mobileNumber,
          order.province,
          order.extraAddress,
          order.note,
          order.specialRequests,
          order.subtotal,
          order.total,
          order.status,
          order.createdByRole,
          order.createdByName,
          order.createdByUserId ?? null,
          order.createdAt,
          order.acceptedAt,
          order.completedAt,
          order.updatedAt,
          order.cancelReason,
        ),
    );

    for (const item of order.items) {
      statements.push(
        env.DB
          .prepare(
            `
            INSERT INTO order_items (id, order_id, name, image, price, quantity, line_total)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
          )
          .bind(item.id, order.id, item.name, item.image ?? null, item.price, item.quantity, item.lineTotal),
      );
    }
  }

  for (const notification of payload.notifications) {
    statements.push(
      env.DB
        .prepare(
          `
          INSERT INTO notifications (
            id, target_role, target_display_name, order_id, order_number, title, message, is_read, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
        )
        .bind(
          notification.id,
          notification.targetRole,
          notification.targetDisplayName,
          notification.orderId,
          notification.orderNumber,
          notification.title,
          notification.message,
          notification.isRead ? 1 : 0,
          notification.createdAt,
        ),
    );
  }

  for (const log of payload.activityLogs) {
    statements.push(
      env.DB
        .prepare(
          `
          INSERT INTO activity_logs (id, type, message, actor_role, actor_name, order_id, metadata_json, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
        )
        .bind(
          log.id,
          log.type,
          log.message,
          log.actorRole,
          log.actorName,
          log.orderId ?? null,
          log.metadataJson ?? null,
          log.createdAt,
        ),
    );
  }

  await env.DB.batch(statements);

  await addActivityLog(env, {
    type: 'backup_imported',
    message: 'backupـێک هاتە ناوەوە و داتا گەڕایەوە.',
    actor,
  });

  return getAppSettings(env);
};

export const addActivityLog = async (
  env: AppBindings,
  input: {
    type: string;
    message: string;
    actor: Actor;
    orderId?: string | null;
    metadataJson?: string | null;
  },
) => {
  const log: ActivityLog = {
    id: crypto.randomUUID(),
    type: input.type,
    message: input.message,
    actorRole: input.actor.role,
    actorName: input.actor.displayName,
    orderId: input.orderId ?? null,
    metadataJson: input.metadataJson ?? null,
    createdAt: nowIso(),
  };

  await env.DB
    .prepare(
      `
      INSERT INTO activity_logs (id, type, message, actor_role, actor_name, order_id, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .bind(log.id, log.type, log.message, log.actorRole, log.actorName, log.orderId, log.metadataJson, log.createdAt)
    .run();

  return log;
};





