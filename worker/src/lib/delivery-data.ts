import type {
  Actor,
  AppSettings,
  BackupPayload,
  DeleteOrdersPreviewDto,
  DeliveryNotification,
  DeliveryOrder,
  OrderItem,
  OrdersNotificationsSummaryDto,
  OrderStatus,
  UserRole,
} from '../../../shared/models';
import { BUSINESS_TIME_ZONE, getBusinessDayKey, isDeliveryMobileBlockWindowActive } from '../../../shared/business-time';
import type { AppBindings, AuthUser } from '../env';
import {
  addActivityLog,
  ensureCoreData,
  exportBackup as exportTravelBackup,
  getAppSettings,
  importBackup as importTravelBackup,
  listMenuItems,
  prepareBlankSystem as prepareTravelBlankSystem,
} from './data';

type DbRow = Record<string, unknown>;

const DELIVERY_ORDER_SELECT_SQL = `
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
FROM delivery_orders
`;

const DELIVERY_NOTIFICATION_SELECT_SQL = `
SELECT
  id,
  target_role AS targetRole,
  target_display_name AS targetDisplayName,
  delivery_order_id AS deliveryOrderId,
  delivery_order_number AS deliveryOrderNumber,
  title,
  message,
  is_read AS isRead,
  created_at AS createdAt
FROM delivery_notifications
`;

const nowIso = () => new Date().toISOString();

const boolFromDb = (value: unknown) => value === 1 || value === true || value === '1';

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

const deleteRowsByIds = async (env: AppBindings, tableName: string, ids: string[]) => {
  for (const chunk of chunkValues(ids)) {
    await env.DB.prepare(`DELETE FROM ${tableName} WHERE id IN (${buildInClause(chunk.length)})`).bind(...chunk).run();
  }
};

const normalizeMobileNumber = (value: string) => value.replace(/\D+/g, '');

const countTable = async (env: AppBindings, tableName: string) =>
  Number((await env.DB.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).first<{ count: number }>())?.count ?? 0);

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
  input: {
    rangeType: 'yesterday' | 'single_day' | 'custom_range';
    date?: string;
    fromDate?: string;
    toDate?: string;
  },
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

const normalizeRoles = (roles: UserRole[]) => Array.from(new Set(roles));

const extractCounterValue = (orderNumber: string) => {
  const matched = orderNumber.match(/(\d+)$/);
  return matched ? Number(matched[1]) : 0;
};

const listTravelOrdersForDeletion = async (env: AppBindings, roles: UserRole[], fromDate: string, toDate: string) => {
  const rows = await env.DB
    .prepare(
      `
      SELECT id, total, created_at AS createdAt
      FROM orders
      WHERE created_by_role IN (${buildInClause(roles.length)})
      `,
    )
    .bind(...roles)
    .all<DbRow>();

  return (rows.results ?? []).filter((row) => matchesRange(String(row.createdAt ?? ''), fromDate, toDate));
};

const listDeliveryOrdersForDeletion = async (env: AppBindings, roles: UserRole[], fromDate: string, toDate: string) => {
  const rows = await env.DB
    .prepare(
      `
      SELECT id, total, created_at AS createdAt
      FROM delivery_orders
      WHERE created_by_role IN (${buildInClause(roles.length)})
      `,
    )
    .bind(...roles)
    .all<DbRow>();

  return (rows.results ?? []).filter((row) => matchesRange(String(row.createdAt ?? ''), fromDate, toDate));
};

const listTravelNotificationIdsForDeletion = async (
  env: AppBindings,
  roles: UserRole[],
  fromDate: string,
  toDate: string,
  orderIds: string[],
  includeStandaloneNotifications: boolean,
) => {
  const ids = new Set<string>();

  if (orderIds.length > 0) {
    const rows = await queryRowsByChunks(env, (placeholders) => `SELECT id FROM notifications WHERE order_id IN (${placeholders})`, orderIds);
    for (const row of rows) {
      ids.add(String(row.id ?? ''));
    }
  }

  if (includeStandaloneNotifications) {
    const rows = await env.DB
      .prepare(
        `
        SELECT id, created_at AS createdAt
        FROM notifications
        WHERE target_role IN (${buildInClause(roles.length)})
        `,
      )
      .bind(...roles)
      .all<DbRow>();
    for (const row of rows.results ?? []) {
      if (matchesRange(String(row.createdAt ?? ''), fromDate, toDate)) {
        ids.add(String(row.id ?? ''));
      }
    }
  }

  return Array.from(ids);
};

const listDeliveryNotificationIdsForDeletion = async (
  env: AppBindings,
  roles: UserRole[],
  fromDate: string,
  toDate: string,
  deliveryOrderIds: string[],
  includeStandaloneNotifications: boolean,
) => {
  const ids = new Set<string>();

  if (deliveryOrderIds.length > 0) {
    const rows = await queryRowsByChunks(
      env,
      (placeholders) => `SELECT id FROM delivery_notifications WHERE delivery_order_id IN (${placeholders})`,
      deliveryOrderIds,
    );
    for (const row of rows) {
      ids.add(String(row.id ?? ''));
    }
  }

  if (includeStandaloneNotifications) {
    const rows = await env.DB
      .prepare(
        `
        SELECT id, created_at AS createdAt
        FROM delivery_notifications
        WHERE target_role IN (${buildInClause(roles.length)})
        `,
      )
      .bind(...roles)
      .all<DbRow>();
    for (const row of rows.results ?? []) {
      if (matchesRange(String(row.createdAt ?? ''), fromDate, toDate)) {
        ids.add(String(row.id ?? ''));
      }
    }
  }

  return Array.from(ids);
};

const listActivityLogIdsForDeletion = async (
  env: AppBindings,
  roles: UserRole[],
  fromDate: string,
  toDate: string,
) => {
  const deleteAllRoles = roles.length === 3 && roles.includes('employee') && roles.includes('captain') && roles.includes('admin');
  const rows = deleteAllRoles
    ? await env.DB
        .prepare(
          `
          SELECT id, created_at AS createdAt
          FROM activity_logs
          ORDER BY created_at DESC
          `,
        )
        .all<DbRow>()
    : await env.DB
        .prepare(
          `
          SELECT id, created_at AS createdAt
          FROM activity_logs
          WHERE actor_role IN (${buildInClause(roles.length)})
          ORDER BY created_at DESC
          `,
        )
        .bind(...roles)
        .all<DbRow>();

  return (rows.results ?? [])
    .filter((row) => matchesRange(String(row.createdAt ?? ''), fromDate, toDate))
    .map((row) => String(row.id ?? ''));
};

const asDeliveryNotification = (row: DbRow): DeliveryNotification => ({
  id: String(row.id ?? ''),
  targetRole: String(row.targetRole ?? 'employee') as DeliveryNotification['targetRole'],
  targetDisplayName: row.targetDisplayName ? String(row.targetDisplayName) : null,
  deliveryOrderId: String(row.deliveryOrderId ?? ''),
  deliveryOrderNumber: String(row.deliveryOrderNumber ?? ''),
  title: String(row.title ?? ''),
  message: String(row.message ?? ''),
  isRead: boolFromDb(row.isRead),
  createdAt: String(row.createdAt ?? ''),
});

const asDeliveryOrderItemRow = (row: DbRow): (OrderItem & { deliveryOrderId: string }) => ({
  id: String(row.id ?? ''),
  deliveryOrderId: String(row.deliveryOrderId ?? ''),
  name: String(row.name ?? ''),
  image: row.image ? String(row.image) : undefined,
  price: Number(row.price ?? 0),
  quantity: Number(row.quantity ?? 0),
  lineTotal: Number(row.lineTotal ?? 0),
});

const asDeliveryOrder = (row: DbRow, items: OrderItem[]): DeliveryOrder => ({
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
  createdByRole: String(row.createdByRole ?? 'employee') as DeliveryOrder['createdByRole'],
  createdByName: String(row.createdByName ?? ''),
  createdByUserId: row.createdByUserId ? String(row.createdByUserId) : null,
  createdAt: String(row.createdAt ?? ''),
  acceptedAt: row.acceptedAt ? String(row.acceptedAt) : null,
  completedAt: row.completedAt ? String(row.completedAt) : null,
  updatedAt: String(row.updatedAt ?? ''),
  cancelReason: String(row.cancelReason ?? ''),
});

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

const allocateDeliveryOrderSequence = async (env: AppBindings, timestamp: string) => {
  const counter = await env.DB
    .prepare(
      `
      UPDATE order_counters
      SET next_value = next_value + 1, updated_at = ?
      WHERE scope = 'delivery_orders'
      RETURNING next_value AS nextValue
      `,
    )
    .bind(timestamp)
    .first<{ nextValue: number }>();

  if (!counter) {
    await env.DB
      .prepare(
        `
        INSERT INTO order_counters (scope, next_value, updated_at)
        VALUES ('delivery_orders', 0, ?)
        ON CONFLICT(scope) DO UPDATE SET updated_at = excluded.updated_at
        `,
      )
      .bind(timestamp)
      .run();

    return allocateDeliveryOrderSequence(env, timestamp);
  }

  return Number(counter.nextValue ?? 0);
};

const assertUniqueDeliveryMobile = async (
  env: AppBindings,
  settings: Pick<AppSettings, 'deliveryMobileBlockEnabled'>,
  mobileNumber: string,
  referenceTimestamp: string,
  ignoredOrderId?: string,
) => {
  const normalizedMobileNumber = normalizeMobileNumber(mobileNumber);
  if (!settings.deliveryMobileBlockEnabled || !isDeliveryMobileBlockWindowActive(referenceTimestamp)) {
    return normalizedMobileNumber;
  }

  const rows = await env.DB
    .prepare(
      `
      SELECT id, order_number AS orderNumber, created_at AS createdAt
      FROM delivery_orders
      WHERE mobile_number = ?
      ${ignoredOrderId ? 'AND id != ?' : ''}
      ORDER BY created_at DESC
      `,
    )
    .bind(...(ignoredOrderId ? [normalizedMobileNumber, ignoredOrderId] : [normalizedMobileNumber]))
    .all<DbRow>();

  const currentDayKey = getBusinessDayKey(referenceTimestamp);
  const existing = (rows.results ?? []).find((row) => {
    const createdAt = String(row.createdAt ?? '');
    return createdAt.length > 0 && getBusinessDayKey(createdAt) === currentDayKey;
  });

  if (existing) {
    throw new Error(`ژمارەی مۆبایل ${normalizedMobileNumber} ئەمڕۆ پێشتر بۆ گەیاندن تۆمارکراوە (${String(existing.orderNumber ?? '')}).`);
  }

  return normalizedMobileNumber;
};

export const listDeliveryOrders = async (
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
  const rows = await env.DB
    .prepare(`${DELIVERY_ORDER_SELECT_SQL}${whereClause} ORDER BY created_at DESC`)
    .bind(...values)
    .all<DbRow>();
  const deliveryOrderRows = rows.results ?? [];
  if (deliveryOrderRows.length === 0) {
    return [];
  }

  const deliveryOrderIds = deliveryOrderRows.map((row) => String(row.id));
  const itemRows = await queryRowsByChunks(
    env,
    (placeholders) => `
      SELECT
        id,
        delivery_order_id AS deliveryOrderId,
        name,
        image,
        price,
        quantity,
        line_total AS lineTotal
      FROM delivery_order_items
      WHERE delivery_order_id IN (${placeholders})
      ORDER BY rowid ASC
      `,
    deliveryOrderIds,
  );

  const itemsByOrderId = itemRows.map(asDeliveryOrderItemRow).reduce<Record<string, OrderItem[]>>((groups, item) => {
    groups[item.deliveryOrderId] = [...(groups[item.deliveryOrderId] ?? []), {
      id: item.id,
      name: item.name,
      image: item.image,
      price: item.price,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    }];
    return groups;
  }, {});

  return deliveryOrderRows.map((row) => asDeliveryOrder(row, itemsByOrderId[String(row.id)] ?? []));
};

export const getDeliveryOrderById = async (env: AppBindings, deliveryOrderId: string) => {
  const orders = await listDeliveryOrders(env);
  return orders.find((order) => order.id === deliveryOrderId) ?? null;
};

export const createDeliveryOrder = async (
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
  const deliveryOrderId = crypto.randomUUID();
  const nextSequence = await allocateDeliveryOrderSequence(env, persistedAt);
  const orderNumber = `DLV-${String(nextSequence).padStart(4, '0')}`;
  const normalizedMobileNumber = await assertUniqueDeliveryMobile(env, settings, input.mobileNumber, persistedAt);

  const statements: D1PreparedStatement[] = [
    env.DB
      .prepare(
        `
        INSERT INTO delivery_orders (
          id, order_number, customer_name, mobile_number, province, extra_address, note, special_requests,
          subtotal, total, status, created_by_role, created_by_name, created_by_user_id, created_at, accepted_at,
          completed_at, updated_at, cancel_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_captain', ?, ?, ?, ?, NULL, NULL, ?, '')
        `,
      )
      .bind(
        deliveryOrderId,
        orderNumber,
        input.customerName,
        normalizedMobileNumber,
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
          INSERT INTO delivery_order_items (id, delivery_order_id, name, image, price, quantity, line_total)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
        )
        .bind(crypto.randomUUID(), deliveryOrderId, item.name, item.image ?? null, item.price, item.quantity, item.lineTotal),
    ),
    env.DB
      .prepare(
        `
        INSERT INTO delivery_notifications (
          id, target_role, target_display_name, delivery_order_id, delivery_order_number, title, message, is_read, created_at
        ) VALUES (?, 'captain', NULL, ?, ?, ?, ?, 0, ?)
        `,
      )
      .bind(
        crypto.randomUUID(),
        deliveryOrderId,
        orderNumber,
        `گەیاندنێکی نوێ هات: ${orderNumber}`,
        `${authUser.displayName} داواکاریی گەیاندنی نوێ نارد.`,
        persistedAt,
      ),
    env.DB
      .prepare(
        `
        INSERT INTO delivery_notifications (
          id, target_role, target_display_name, delivery_order_id, delivery_order_number, title, message, is_read, created_at
        ) VALUES (?, 'admin', NULL, ?, ?, ?, ?, 0, ?)
        `,
      )
      .bind(
        crypto.randomUUID(),
        deliveryOrderId,
        orderNumber,
        `گەیاندنێکی نوێ هات: ${orderNumber}`,
        `${authUser.displayName} داواکاریی گەیاندنی نوێ نارد.`,
        persistedAt,
      ),
  ];

  await env.DB.batch(statements);

  const order = await getDeliveryOrderById(env, deliveryOrderId);
  if (!order) {
    throw new Error('ناتوانرێت داواکاریی گەیاندنەکە بدۆزرێتەوە.');
  }

  return order;
};

export const updateDeliveryOrderStatus = async (
  env: AppBindings,
  deliveryOrderId: string,
  status: OrderStatus,
  actor: AuthUser,
  cancelReason = '',
) => {
  const existing = await getDeliveryOrderById(env, deliveryOrderId);
  if (!existing) {
    throw new Error('داواکاریی گەیاندن نەدۆزرایەوە.');
  }

  assertOrderStatusTransition(existing.status, status, actor.role);

  const timestamp = nowIso();
  const acceptedAt = status === 'accepted' ? timestamp : existing.acceptedAt;
  const completedAt = status === 'completed' ? timestamp : existing.completedAt;

  await env.DB
    .prepare(
      `
      UPDATE delivery_orders
      SET status = ?, accepted_at = ?, completed_at = ?, updated_at = ?, cancel_reason = ?
      WHERE id = ?
      `,
    )
    .bind(status, acceptedAt, completedAt, timestamp, status === 'cancelled' ? cancelReason : '', deliveryOrderId)
    .run();

  if (status === 'accepted' || status === 'completed' || status === 'cancelled') {
    await env.DB.batch([
      env.DB
        .prepare(
          `
          INSERT INTO delivery_notifications (
            id, target_role, target_display_name, delivery_order_id, delivery_order_number, title, message, is_read, created_at
          ) VALUES (?, 'employee', ?, ?, ?, ?, ?, 0, ?)
          `,
        )
        .bind(
          crypto.randomUUID(),
          existing.createdByName,
          existing.id,
          existing.orderNumber,
          status === 'cancelled'
            ? `گەیاندنەکەت هەڵوەشایەوە: ${existing.orderNumber}`
            : status === 'completed'
              ? `گەیاندنەکەت تەواوبوو: ${existing.orderNumber}`
              : `گەیاندنەکەت قبوڵ کرا: ${existing.orderNumber}`,
          status === 'cancelled'
            ? cancelReason || `داواکاریی ${existing.orderNumber} هەڵوەشایەوە.`
            : status === 'completed'
              ? `داواکاریی ${existing.orderNumber} بە شێوازی گەیاندن تەواوبوو.`
              : `کاپتن داواکاریی ${existing.orderNumber} بۆ گەیاندن قبوڵ کرد.`,
          timestamp,
        ),
      env.DB
        .prepare(
          `
          INSERT INTO delivery_notifications (
            id, target_role, target_display_name, delivery_order_id, delivery_order_number, title, message, is_read, created_at
          ) VALUES (?, 'admin', NULL, ?, ?, ?, ?, 0, ?)
          `,
        )
        .bind(
          crypto.randomUUID(),
          existing.id,
          existing.orderNumber,
          status === 'cancelled'
            ? `گەیاندن هەڵوەشایەوە: ${existing.orderNumber}`
            : status === 'completed'
              ? `گەیاندن تەواوبوو: ${existing.orderNumber}`
              : `گەیاندن قبوڵ کرا: ${existing.orderNumber}`,
          status === 'cancelled'
            ? cancelReason || `داواکاریی ${existing.orderNumber} هەڵوەشایەوە.`
            : status === 'completed'
              ? `داواکاریی ${existing.orderNumber} بە شێوازی گەیاندن تەواوبوو.`
              : `کاپتن داواکاریی ${existing.orderNumber} بۆ گەیاندن قبوڵ کرد.`,
          timestamp,
        ),
    ]);
  }

  return getDeliveryOrderById(env, deliveryOrderId);
};

export const listDeliveryNotificationsForUser = async (env: AppBindings, authUser: AuthUser) => {
  await ensureCoreData(env);
  const rows = await env.DB
    .prepare(
      `${DELIVERY_NOTIFICATION_SELECT_SQL}
       WHERE target_role = ?
       AND (target_display_name IS NULL OR target_display_name = ?)
       ORDER BY created_at DESC`,
    )
    .bind(authUser.role, authUser.displayName)
    .all<DbRow>();
  return (rows.results ?? []).map(asDeliveryNotification);
};

export const listAllDeliveryNotifications = async (env: AppBindings) => {
  await ensureCoreData(env);
  const rows = await env.DB.prepare(`${DELIVERY_NOTIFICATION_SELECT_SQL} ORDER BY created_at DESC`).all<DbRow>();
  return (rows.results ?? []).map(asDeliveryNotification);
};

export const markDeliveryNotificationsReadForUser = async (env: AppBindings, authUser: AuthUser) => {
  await env.DB
    .prepare(
      `
      UPDATE delivery_notifications
      SET is_read = 1
      WHERE target_role = ?
      AND (target_display_name IS NULL OR target_display_name = ?)
      `,
    )
    .bind(authUser.role, authUser.displayName)
    .run();
  return true;
};

export const clearAllDeliveryNotifications = async (env: AppBindings) => {
  await env.DB.prepare('DELETE FROM delivery_notifications').run();
  return true;
};

export const previewDeleteOrdersAndNotifications = async (
  env: AppBindings,
  input: {
    rangeType: 'yesterday' | 'single_day' | 'custom_range';
    roles: UserRole[];
    includeTravelOrders: boolean;
    includeDeliveryOrders: boolean;
    includeTravelNotifications: boolean;
    includeDeliveryNotifications: boolean;
    includeActivityLogs: boolean;
    date?: string;
    fromDate?: string;
    toDate?: string;
  },
): Promise<DeleteOrdersPreviewDto> => {
  await ensureCoreData(env);

  const roles = normalizeRoles(input.roles);
  const { fromDate, toDate } = getRangeBounds(input);
  const travelOrderRows = input.includeTravelOrders ? await listTravelOrdersForDeletion(env, roles, fromDate, toDate) : [];
  const deliveryOrderRows = input.includeDeliveryOrders ? await listDeliveryOrdersForDeletion(env, roles, fromDate, toDate) : [];
  const travelOrderIds = travelOrderRows.map((row) => String(row.id ?? ''));
  const deliveryOrderIds = deliveryOrderRows.map((row) => String(row.id ?? ''));
  const [travelNotificationIds, deliveryNotificationIds, activityLogIds] = await Promise.all([
    listTravelNotificationIdsForDeletion(env, roles, fromDate, toDate, travelOrderIds, input.includeTravelNotifications),
    listDeliveryNotificationIdsForDeletion(env, roles, fromDate, toDate, deliveryOrderIds, input.includeDeliveryNotifications),
    input.includeActivityLogs ? listActivityLogIdsForDeletion(env, roles, fromDate, toDate) : Promise.resolve([]),
  ]);

  const totalSalesImpact =
    travelOrderRows.reduce((sum, row) => sum + Number(row.total ?? 0), 0) +
    deliveryOrderRows.reduce((sum, row) => sum + Number(row.total ?? 0), 0);

  const travelOrders = travelOrderRows.length;
  const deliveryOrders = deliveryOrderRows.length;
  const travelNotifications = travelNotificationIds.length;
  const deliveryNotifications = deliveryNotificationIds.length;
  const activityLogCount = activityLogIds.length;

  return {
    rangeType: input.rangeType,
    roles,
    fromDate,
    toDate,
    includeTravelOrders: input.includeTravelOrders,
    includeDeliveryOrders: input.includeDeliveryOrders,
    includeTravelNotifications: input.includeTravelNotifications,
    includeDeliveryNotifications: input.includeDeliveryNotifications,
    includeActivityLogs: input.includeActivityLogs,
    travelOrders,
    deliveryOrders,
    travelNotifications,
    deliveryNotifications,
    totalRecords: travelOrders + deliveryOrders + travelNotifications + deliveryNotifications + activityLogCount,
    activityLogCount,
    totalSalesImpact,
  };
};

export const executeDeleteOrdersAndNotifications = async (
  env: AppBindings,
  input: {
    rangeType: 'yesterday' | 'single_day' | 'custom_range';
    roles: UserRole[];
    includeTravelOrders: boolean;
    includeDeliveryOrders: boolean;
    includeTravelNotifications: boolean;
    includeDeliveryNotifications: boolean;
    includeActivityLogs: boolean;
    date?: string;
    fromDate?: string;
    toDate?: string;
  },
  actor: Actor,
): Promise<DeleteOrdersPreviewDto> => {
  const preview = await previewDeleteOrdersAndNotifications(env, input);
  if (preview.totalRecords === 0) {
    return preview;
  }

  const travelOrderRows = preview.includeTravelOrders
    ? await listTravelOrdersForDeletion(env, preview.roles, preview.fromDate, preview.toDate)
    : [];
  const deliveryOrderRows = preview.includeDeliveryOrders
    ? await listDeliveryOrdersForDeletion(env, preview.roles, preview.fromDate, preview.toDate)
    : [];
  const travelOrderIds = travelOrderRows.map((row) => String(row.id ?? ''));
  const deliveryOrderIds = deliveryOrderRows.map((row) => String(row.id ?? ''));
  const [travelNotificationIds, deliveryNotificationIds, activityLogIds] = await Promise.all([
    listTravelNotificationIdsForDeletion(env, preview.roles, preview.fromDate, preview.toDate, travelOrderIds, preview.includeTravelNotifications),
    listDeliveryNotificationIdsForDeletion(
      env,
      preview.roles,
      preview.fromDate,
      preview.toDate,
      deliveryOrderIds,
      preview.includeDeliveryNotifications,
    ),
    preview.includeActivityLogs ? listActivityLogIdsForDeletion(env, preview.roles, preview.fromDate, preview.toDate) : Promise.resolve([]),
  ]);

  await deleteRowsByIds(env, 'activity_logs', activityLogIds);
  await deleteRowsByIds(env, 'notifications', travelNotificationIds);
  await deleteRowsByIds(env, 'delivery_notifications', deliveryNotificationIds);
  await deleteRowsByIds(env, 'delivery_orders', deliveryOrderIds);
  await deleteRowsByIds(env, 'orders', travelOrderIds);

  await addActivityLog(env, {
    type: 'orders_notifications_deleted_by_range',
    message:
      preview.includeActivityLogs && preview.roles.length === 3
        ? `ئادمێن ${actor.displayName} هەموو داتاکانی دیاریکراوی لە نێوان ${preview.fromDate} تا ${preview.toDate} سڕییەوە.`
        : `ئادمێن ${actor.displayName} داتاکانی دیاریکراوی لە نێوان ${preview.fromDate} تا ${preview.toDate} سڕییەوە.`,
    actor,
    metadataJson: JSON.stringify({
      roles: preview.roles,
      travelOrders: preview.travelOrders,
      deliveryOrders: preview.deliveryOrders,
      travelNotifications: preview.travelNotifications,
      deliveryNotifications: preview.deliveryNotifications,
      activityLogCount: preview.activityLogCount,
    }),
  });

  return preview;
};

export const getOrdersNotificationsSummary = async (env: AppBindings): Promise<OrdersNotificationsSummaryDto> => {
  await ensureCoreData(env);

  const [travelOrders, deliveryOrders, travelNotifications, deliveryNotifications] = await Promise.all([
    countTable(env, 'orders'),
    countTable(env, 'delivery_orders'),
    countTable(env, 'notifications'),
    countTable(env, 'delivery_notifications'),
  ]);

  return {
    travelOrders,
    deliveryOrders,
    travelNotifications,
    deliveryNotifications,
    totalOrders: travelOrders + deliveryOrders,
    totalNotifications: travelNotifications + deliveryNotifications,
  };
};

export const clearAllOrdersAndNotifications = async (
  env: AppBindings,
  actor: Actor,
): Promise<OrdersNotificationsSummaryDto> => {
  const summary = await getOrdersNotificationsSummary(env);

  await env.DB.batch([
    env.DB.prepare('DELETE FROM delivery_order_items'),
    env.DB.prepare('DELETE FROM order_items'),
    env.DB.prepare('DELETE FROM delivery_notifications'),
    env.DB.prepare('DELETE FROM notifications'),
    env.DB.prepare('DELETE FROM delivery_orders'),
    env.DB.prepare('DELETE FROM orders'),
  ]);

  await addActivityLog(env, {
    type: 'orders_notifications_cleared',
    message: `ئادمێن ${actor.displayName} هەموو orders و ئاگەدارکردنەوەکان پاککردەوە.`,
    actor,
  });

  return summary;
};

const csvEscape = (value: string | number | null | undefined) => {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

export const exportDeliveryOrdersCsv = async (env: AppBindings) => {
  const orders = await listDeliveryOrders(env);
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

export const exportCombinedBackup = async (env: AppBindings): Promise<BackupPayload> => {
  const [travelBackup, deliveryOrders, deliveryNotifications] = await Promise.all([
    exportTravelBackup(env),
    listDeliveryOrders(env),
    listAllDeliveryNotifications(env),
  ]);

  return {
    ...travelBackup,
    deliveryOrders,
    deliveryNotifications,
  };
};

export const importCombinedBackup = async (env: AppBindings, payload: BackupPayload, actor: Actor) => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM delivery_order_items'),
    env.DB.prepare('DELETE FROM delivery_notifications'),
    env.DB.prepare('DELETE FROM delivery_orders'),
  ]);

  const settings = await importTravelBackup(env, {
    ...payload,
    deliveryOrders: payload.deliveryOrders ?? [],
    deliveryNotifications: payload.deliveryNotifications ?? [],
  }, actor);

  const deliveryOrders = payload.deliveryOrders ?? [];
  const deliveryNotifications = payload.deliveryNotifications ?? [];
  const nextCounterValue = deliveryOrders.reduce((maxValue, order) => Math.max(maxValue, extractCounterValue(order.orderNumber)), 0);
  const statements: D1PreparedStatement[] = [
    env.DB
      .prepare(
        `
        INSERT INTO order_counters (scope, next_value, updated_at)
        VALUES ('delivery_orders', ?, ?)
        ON CONFLICT(scope) DO UPDATE
        SET next_value = excluded.next_value, updated_at = excluded.updated_at
        `,
      )
      .bind(nextCounterValue, payload.settings.updatedAt),
  ];

  for (const order of deliveryOrders) {
    const normalizedMobileNumber = normalizeMobileNumber(order.mobileNumber);
    statements.push(
      env.DB
        .prepare(
          `
          INSERT INTO delivery_orders (
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
          normalizedMobileNumber,
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
            INSERT INTO delivery_order_items (id, delivery_order_id, name, image, price, quantity, line_total)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
          )
          .bind(item.id, order.id, item.name, item.image ?? null, item.price, item.quantity, item.lineTotal),
      );
    }
  }

  for (const notification of deliveryNotifications) {
    statements.push(
      env.DB
        .prepare(
          `
          INSERT INTO delivery_notifications (
            id, target_role, target_display_name, delivery_order_id, delivery_order_number, title, message, is_read, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
        )
        .bind(
          notification.id,
          notification.targetRole,
          notification.targetDisplayName,
          notification.deliveryOrderId,
          notification.deliveryOrderNumber,
          notification.title,
          notification.message,
          notification.isRead ? 1 : 0,
          notification.createdAt,
        ),
    );
  }

  await env.DB.batch(statements);
  return settings;
};

export const prepareBlankSystemWithDelivery = async (env: AppBindings, actor: Actor) => {
  const settings = await prepareTravelBlankSystem(env, actor);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM delivery_order_items'),
    env.DB.prepare('DELETE FROM delivery_notifications'),
    env.DB.prepare('DELETE FROM delivery_orders'),
    env.DB
      .prepare(
        `
        INSERT INTO order_counters (scope, next_value, updated_at)
        VALUES ('delivery_orders', 0, ?)
        ON CONFLICT(scope) DO UPDATE
        SET next_value = 0, updated_at = excluded.updated_at
        `,
      )
      .bind(settings.updatedAt),
  ]);

  return settings;
};







