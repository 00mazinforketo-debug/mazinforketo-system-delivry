import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { BackupPayload } from '../../shared/models';
import {
  businessSettingsInputSchema,
  categoryInputSchema,
  createDeliveryOrderInputSchema,
  createOrderInputSchema,
  deleteOrdersRangeSchema,
  deliveryOrderStatusUpdateSchema,
  loginInputSchema,
  menuItemInputSchema,
  orderStatusUpdateSchema,
  visibilityInputSchema,
} from '../../shared/schemas';
import { authOptional, cleanupExpiredSessions, clearAuthSession, createSessionForPin, requireAuth, requireRole } from './lib/auth';
import { jsonError, jsonSuccess } from './lib/api';
import { bootstrapDatabase } from './lib/schema-bootstrap';
import {
  clearAllNotifications,
  createOrder,
  deleteCategory,
  deleteMenuItem,
  detachMediaAsset,
  ensureCoreData,
  exportOrdersCsv,
  getAppSettings,
  getEmployeeActivityAnalytics,
  getMediaObject,
  getOrderById,
  getReportsSummary,
  listActivityLogs,
  listAllNotifications,
  listCategories,
  listMediaAssets,
  listMediaUsage,
  listMenuItems,
  listNotificationsForUser,
  listOrders,
  markNotificationsReadForUser,
  saveCategory,
  saveMenuItem,
  setCatalogVisibility,
  setMenuAvailability,
  updateBusinessSettings,
  updateOrderStatus,
  uploadMediaAsset,
} from './lib/data';
import {
  clearAllDeliveryNotifications,
  clearAllOrdersAndNotifications,
  executeDeleteOrdersAndNotifications,
  createDeliveryOrder,
  exportCombinedBackup,
  exportDeliveryOrdersCsv,
  getDeliveryOrderById,
  getOrdersNotificationsSummary,
  importCombinedBackup,
  listAllDeliveryNotifications,
  listDeliveryNotificationsForUser,
  listDeliveryOrders,
  markDeliveryNotificationsReadForUser,
  previewDeleteOrdersAndNotifications,
  prepareBlankSystemWithDelivery,
  updateDeliveryOrderStatus,
} from './lib/delivery-data';
import type { AppBindings, AppVariables } from './env';

const app = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>();

app.onError((error, c) => {
  if (error instanceof HTTPException) {
    return jsonError(c, error.message, error.status);
  }

  return jsonError(c, error instanceof Error ? error.message : 'هەڵەیەک ڕوویدا.', 500);
});

app.use('/api/*', bootstrapDatabase);
app.use('/api/*', authOptional);

app.get('/api/health', async (c) => {
  await cleanupExpiredSessions(c.env);
  await ensureCoreData(c.env);
  return jsonSuccess(c, {
    ok: true,
    environment: c.env.APP_ENV,
    now: new Date().toISOString(),
  });
});

app.post('/api/auth/login', zValidator('json', loginInputSchema), async (c) => {
  await ensureCoreData(c.env);
  const { pin } = c.req.valid('json');
  const session = await createSessionForPin(c, pin);
  return jsonSuccess(c, { session });
});

app.get('/api/auth/me', async (c) => {
  const authUser = requireAuth(c);
  return jsonSuccess(c, {
    session: {
      userId: authUser.userId,
      role: authUser.role,
      displayName: authUser.displayName,
      loginAt: authUser.loginAt,
    },
  });
});

app.post('/api/auth/logout', async (c) => {
  await clearAuthSession(c);
  return jsonSuccess(c, { ok: true });
});

app.get('/api/settings', async (c) => {
  requireAuth(c);
  return jsonSuccess(c, await getAppSettings(c.env));
});

app.put('/api/settings/business', zValidator('json', businessSettingsInputSchema), async (c) => {
  const authUser = requireRole(c, 'admin');
  return jsonSuccess(
    c,
    await updateBusinessSettings(c.env, c.req.valid('json'), { role: authUser.role, displayName: authUser.displayName }),
  );
});

app.post('/api/settings/visibility', zValidator('json', visibilityInputSchema), async (c) => {
  const authUser = requireRole(c, 'admin');
  return jsonSuccess(
    c,
    await setCatalogVisibility(c.env, c.req.valid('json'), { role: authUser.role, displayName: authUser.displayName }),
  );
});

app.get('/api/categories', async (c) => {
  requireAuth(c);
  return jsonSuccess(c, await listCategories(c.env));
});

app.post('/api/categories', zValidator('json', categoryInputSchema), async (c) => {
  const authUser = requireRole(c, 'admin');
  return jsonSuccess(
    c,
    await saveCategory(c.env, c.req.valid('json'), { role: authUser.role, displayName: authUser.displayName }),
  );
});

app.put('/api/categories/:id', zValidator('json', categoryInputSchema), async (c) => {
  const authUser = requireRole(c, 'admin');
  return jsonSuccess(
    c,
    await saveCategory(c.env, { ...c.req.valid('json'), id: c.req.param('id') }, { role: authUser.role, displayName: authUser.displayName }),
  );
});

app.delete('/api/categories/:id', async (c) => {
  const authUser = requireRole(c, 'admin');
  await deleteCategory(c.env, c.req.param('id'), { role: authUser.role, displayName: authUser.displayName });
  return jsonSuccess(c, { ok: true });
});

app.get('/api/menu-items', async (c) => {
  requireAuth(c);
  return jsonSuccess(c, await listMenuItems(c.env));
});

app.post('/api/menu-items', zValidator('json', menuItemInputSchema), async (c) => {
  const authUser = requireRole(c, 'admin');
  return jsonSuccess(
    c,
    await saveMenuItem(c.env, c.req.valid('json'), { role: authUser.role, displayName: authUser.displayName }),
  );
});

app.put('/api/menu-items/:id', zValidator('json', menuItemInputSchema), async (c) => {
  const authUser = requireRole(c, 'admin');
  return jsonSuccess(
    c,
    await saveMenuItem(
      c.env,
      {
        ...c.req.valid('json'),
        id: c.req.param('id'),
      },
      { role: authUser.role, displayName: authUser.displayName },
    ),
  );
});

app.delete('/api/menu-items/:id', async (c) => {
  const authUser = requireRole(c, 'admin');
  await deleteMenuItem(c.env, c.req.param('id'), { role: authUser.role, displayName: authUser.displayName });
  return jsonSuccess(c, { ok: true });
});

app.post('/api/menu-items/:id/availability', async (c) => {
  const authUser = requireRole(c, 'admin');
  const body = (await c.req.json()) as { isAvailable?: boolean };
  if (typeof body.isAvailable !== 'boolean') {
    throw new HTTPException(400, { message: 'isAvailable پێویستە.' });
  }

  return jsonSuccess(
    c,
    await setMenuAvailability(c.env, c.req.param('id'), body.isAvailable, { role: authUser.role, displayName: authUser.displayName }),
  );
});

app.get('/api/media', async (c) => {
  requireRole(c, 'admin');
  const includeUsage = c.req.query('includeUsage') === '1';
  return jsonSuccess(c, includeUsage ? await listMediaUsage(c.env) : await listMediaAssets(c.env));
});

app.post('/api/media', async (c) => {
  const authUser = requireRole(c, 'admin');
  const formData = await c.req.formData();
  const fileValue = formData.get('file');
  if (!(fileValue instanceof File)) {
    throw new HTTPException(400, { message: 'فایلی وێنە پێویستە.' });
  }

  const width = Number(formData.get('width') ?? 0);
  const height = Number(formData.get('height') ?? 0);
  return jsonSuccess(
    c,
    await uploadMediaAsset(c.env, fileValue, { width, height }, { role: authUser.role, displayName: authUser.displayName }),
    201,
  );
});

app.delete('/api/media/:id', async (c) => {
  const authUser = requireRole(c, 'admin');
  return jsonSuccess(
    c,
    await detachMediaAsset(c.env, c.req.param('id'), { role: authUser.role, displayName: authUser.displayName }),
  );
});

app.get('/media/:id', async (c) => {
  const media = await getMediaObject(c.env, c.req.param('id'));
  if (!media) {
    throw new HTTPException(404, { message: 'وێنە نەدۆزرایەوە.' });
  }

  const headers = new Headers();
  media.object.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'public, max-age=604800, immutable');
  return new Response(media.object.body, {
    headers,
  });
});

app.get('/api/orders', async (c) => {
  const authUser = requireAuth(c);
  const scope = c.req.query('scope');
  if (authUser.role === 'employee') {
    return jsonSuccess(c, await listOrders(c.env, { creatorUserId: authUser.userId }));
  }

  return jsonSuccess(c, await listOrders(c.env, scope === 'mine' ? { creatorUserId: authUser.userId } : undefined));
});

app.get('/api/orders/:id', async (c) => {
  const authUser = requireAuth(c);
  const order = await getOrderById(c.env, c.req.param('id'));
  if (!order) {
    throw new HTTPException(404, { message: 'داواکاری نەدۆزرایەوە.' });
  }

  if (authUser.role === 'employee' && order.createdByUserId !== authUser.userId) {
    throw new HTTPException(403, { message: 'ڕێگەت پێنەدراوە بۆ ئەم داواکارییە.' });
  }

  return jsonSuccess(c, order);
});

app.post('/api/orders', zValidator('json', createOrderInputSchema), async (c) => {
  const authUser = requireRole(c, ['employee', 'admin']);
  return jsonSuccess(c, await createOrder(c.env, c.req.valid('json'), authUser), 201);
});

app.post('/api/orders/:id/status', zValidator('json', orderStatusUpdateSchema), async (c) => {
  const authUser = requireAuth(c);
  const { status, cancelReason } = c.req.valid('json');
  const existing = await getOrderById(c.env, c.req.param('id'));
  if (!existing) {
    throw new HTTPException(404, { message: 'داواکاری نەدۆزرایەوە.' });
  }

  if (authUser.role === 'employee') {
    if (existing.createdByUserId !== authUser.userId || status !== 'cancelled' || existing.status !== 'pending_captain') {
      throw new HTTPException(403, { message: 'تەنها دەتوانیت داواکاریی خۆت ڕەت بکەیت لە دۆخی چاوەڕێدا.' });
    }
  } else if (authUser.role === 'captain') {
    if (!['accepted', 'completed', 'cancelled'].includes(status)) {
      throw new HTTPException(403, { message: 'ئەو گۆڕانکارییە بۆ کاپتن ڕێگەپێنەدراوە.' });
    }
  } else if (authUser.role !== 'admin') {
    throw new HTTPException(403, { message: 'ڕێگەت پێنەدراوە.' });
  }

  return jsonSuccess(c, await updateOrderStatus(c.env, existing.id, status, authUser, cancelReason));
});

app.get('/api/delivery-orders', async (c) => {
  const authUser = requireAuth(c);
  const scope = c.req.query('scope');
  if (authUser.role === 'employee') {
    return jsonSuccess(c, await listDeliveryOrders(c.env, { creatorUserId: authUser.userId }));
  }

  return jsonSuccess(c, await listDeliveryOrders(c.env, scope === 'mine' ? { creatorUserId: authUser.userId } : undefined));
});

app.get('/api/delivery-orders/:id', async (c) => {
  const authUser = requireAuth(c);
  const order = await getDeliveryOrderById(c.env, c.req.param('id'));
  if (!order) {
    throw new HTTPException(404, { message: 'داواکاریی گەیاندن نەدۆزرایەوە.' });
  }

  if (authUser.role === 'employee' && order.createdByUserId !== authUser.userId) {
    throw new HTTPException(403, { message: 'ڕێگەت پێنەدراوە بۆ ئەم داواکاریی گەیاندنە.' });
  }

  return jsonSuccess(c, order);
});

app.post('/api/delivery-orders', zValidator('json', createDeliveryOrderInputSchema), async (c) => {
  const authUser = requireRole(c, ['employee', 'admin']);

  try {
    return jsonSuccess(c, await createDeliveryOrder(c.env, c.req.valid('json'), authUser), 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'هەڵەیەک ڕوویدا.';
    if (message.includes('ژمارەی مۆبایل')) {
      throw new HTTPException(409, { message });
    }
    if (message.includes('بەردەست نین')) {
      throw new HTTPException(400, { message });
    }
    throw error;
  }
});

app.post('/api/delivery-orders/:id/status', zValidator('json', deliveryOrderStatusUpdateSchema), async (c) => {
  const authUser = requireAuth(c);
  const { status, cancelReason } = c.req.valid('json');
  const existing = await getDeliveryOrderById(c.env, c.req.param('id'));
  if (!existing) {
    throw new HTTPException(404, { message: 'داواکاریی گەیاندن نەدۆزرایەوە.' });
  }

  if (authUser.role === 'employee') {
    if (existing.createdByUserId !== authUser.userId || status !== 'cancelled' || existing.status !== 'pending_captain') {
      throw new HTTPException(403, { message: 'تەنها دەتوانیت داواکاریی گەیاندنی خۆت ڕەت بکەیت لە دۆخی چاوەڕێدا.' });
    }
  } else if (authUser.role === 'captain') {
    if (!['accepted', 'completed', 'cancelled'].includes(status)) {
      throw new HTTPException(403, { message: 'ئەو گۆڕانکارییە بۆ کاپتن ڕێگەپێنەدراوە.' });
    }
  } else if (authUser.role !== 'admin') {
    throw new HTTPException(403, { message: 'ڕێگەت پێنەدراوە.' });
  }

  return jsonSuccess(c, await updateDeliveryOrderStatus(c.env, existing.id, status, authUser, cancelReason));
});

app.get('/api/notifications', async (c) => {
  const authUser = requireAuth(c);
  const scope = c.req.query('scope');
  if (scope === 'all') {
    requireRole(c, 'admin');
    return jsonSuccess(c, await listAllNotifications(c.env));
  }

  return jsonSuccess(c, await listNotificationsForUser(c.env, authUser));
});

app.post('/api/notifications/mark-read', async (c) => {
  const authUser = requireAuth(c);
  await markNotificationsReadForUser(c.env, authUser);
  return jsonSuccess(c, { ok: true });
});

app.post('/api/notifications/clear', async (c) => {
  const authUser = requireRole(c, 'admin');
  await clearAllNotifications(c.env, { role: authUser.role, displayName: authUser.displayName });
  return jsonSuccess(c, { ok: true });
});

app.get('/api/delivery-notifications', async (c) => {
  const authUser = requireAuth(c);
  const scope = c.req.query('scope');
  if (scope === 'all') {
    requireRole(c, 'admin');
    return jsonSuccess(c, await listAllDeliveryNotifications(c.env));
  }

  return jsonSuccess(c, await listDeliveryNotificationsForUser(c.env, authUser));
});

app.post('/api/delivery-notifications/mark-read', async (c) => {
  const authUser = requireAuth(c);
  await markDeliveryNotificationsReadForUser(c.env, authUser);
  return jsonSuccess(c, { ok: true });
});

app.post('/api/delivery-notifications/clear', async (c) => {
  requireRole(c, 'admin');
  await clearAllDeliveryNotifications(c.env);
  return jsonSuccess(c, { ok: true });
});

app.get('/api/activity', async (c) => {
  requireRole(c, 'admin');
  const limit = c.req.query('limit');
  return jsonSuccess(c, await listActivityLogs(c.env, limit ? Number(limit) : undefined));
});

app.get('/api/reports/summary', async (c) => {
  requireRole(c, 'admin');
  return jsonSuccess(c, await getReportsSummary(c.env));
});

app.get('/api/analytics/employee-activity', async (c) => {
  requireRole(c, 'admin');
  return jsonSuccess(c, await getEmployeeActivityAnalytics(c.env));
});

app.post('/api/maintenance/prepare-blank', async (c) => {
  const authUser = requireRole(c, 'admin');
  return jsonSuccess(
    c,
    await prepareBlankSystemWithDelivery(c.env, { role: authUser.role, displayName: authUser.displayName }),
  );
});

app.get('/api/maintenance/orders-notifications-summary', async (c) => {
  requireRole(c, 'admin');
  return jsonSuccess(c, await getOrdersNotificationsSummary(c.env));
});

app.post('/api/maintenance/orders-notifications-clear', async (c) => {
  const authUser = requireRole(c, 'admin');
  return jsonSuccess(
    c,
    await clearAllOrdersAndNotifications(c.env, { role: authUser.role, displayName: authUser.displayName }),
  );
});

app.post('/api/maintenance/orders/delete-preview', zValidator('json', deleteOrdersRangeSchema), async (c) => {
  requireRole(c, 'admin');
  return jsonSuccess(c, await previewDeleteOrdersAndNotifications(c.env, c.req.valid('json')));
});

app.post('/api/maintenance/orders/delete-execute', zValidator('json', deleteOrdersRangeSchema), async (c) => {
  const authUser = requireRole(c, 'admin');
  return jsonSuccess(
    c,
    await executeDeleteOrdersAndNotifications(c.env, c.req.valid('json'), { role: authUser.role, displayName: authUser.displayName }),
  );
});

app.get('/api/exports/orders.csv', async (c) => {
  requireRole(c, 'admin');
  const csv = await exportOrdersCsv(c.env);
  c.header('Content-Type', 'text/csv;charset=utf-8');
  c.header('Content-Disposition', `attachment; filename="restaurant-orders-${new Date().toISOString().slice(0, 10)}.csv"`);
  return c.body(csv);
});

app.get('/api/exports/delivery-orders.csv', async (c) => {
  requireRole(c, 'admin');
  const csv = await exportDeliveryOrdersCsv(c.env);
  c.header('Content-Type', 'text/csv;charset=utf-8');
  c.header('Content-Disposition', `attachment; filename="restaurant-delivery-orders-${new Date().toISOString().slice(0, 10)}.csv"`);
  return c.body(csv);
});

app.get('/api/exports/backup.json', async (c) => {
  requireRole(c, 'admin');
  const backup = await exportCombinedBackup(c.env);
  c.header('Content-Type', 'application/json;charset=utf-8');
  c.header('Content-Disposition', `attachment; filename="restaurant-backup-${backup.exportedAt.slice(0, 10)}.json"`);
  return c.body(JSON.stringify(backup, null, 2));
});

app.get('/api/exports/backup-data', async (c) => {
  requireRole(c, 'admin');
  return jsonSuccess(c, await exportCombinedBackup(c.env));
});

app.post('/api/import/backup', async (c) => {
  const authUser = requireRole(c, 'admin');
  const raw = await c.req.json();
  if (!raw || typeof raw !== 'object') {
    throw new HTTPException(400, { message: 'backup دروست نییە.' });
  }

  return jsonSuccess(
    c,
    await importCombinedBackup(c.env, raw as BackupPayload, {
      role: authUser.role,
      displayName: authUser.displayName,
    }),
  );
});

app.all('*', async (c) => {
  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }

  return jsonError(c, 'Asset handler نەدۆزرایەوە.', 404);
});

export default app;







