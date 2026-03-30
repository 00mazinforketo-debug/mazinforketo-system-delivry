import { z } from 'zod';

export const loginInputSchema = z.object({
  pin: z.string().regex(/^\d{4,8}$/, 'PIN دەبێت ژمارە بێت.'),
});

export const categoryInputSchema = z.object({
  name: z.string().trim().min(2),
  sortOrder: z.coerce.number().int().min(1),
});

export const menuItemInputSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().trim().min(2),
  description: z.string().trim().min(2),
  price: z.coerce.number().positive(),
  image: z.string().min(1),
  imageAssetId: z.string().nullable().optional(),
  isAvailable: z.boolean(),
  sortOrder: z.coerce.number().int().min(1),
});

export const businessSettingsInputSchema = z.object({
  businessName: z.string().trim().min(2),
  provinceOptions: z.array(z.string().trim().min(1)).min(1),
  supportNote: z.string().trim().min(2),
  deliveryMobileBlockEnabled: z.boolean(),
});

export const visibilityInputSchema = z.object({
  entityType: z.enum(['category', 'menuItem']),
  entityId: z.string().min(1),
  isVisible: z.boolean(),
});

export const orderItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  image: z.string().optional(),
  price: z.number().nonnegative(),
  quantity: z.number().int().positive(),
  lineTotal: z.number().nonnegative(),
});

export const createOrderInputSchema = z.object({
  customerName: z.string().trim().min(2),
  mobileNumber: z.string().regex(/^[0-9]{8,15}$/),
  province: z.string().trim().min(2),
  extraAddress: z.string().max(200).optional().default(''),
  note: z.string().max(240).optional().default(''),
  specialRequests: z.string().max(240).optional().default(''),
  items: z.array(orderItemSchema).min(1),
  subtotal: z.number().nonnegative(),
  total: z.number().nonnegative(),
  clientCreatedAt: z.string().datetime().optional(),
});

export const createDeliveryOrderInputSchema = createOrderInputSchema;

export const orderStatusUpdateSchema = z.object({
  status: z.enum(['pending_captain', 'accepted', 'completed', 'cancelled']),
  cancelReason: z.string().max(240).optional().default(''),
});

export const deliveryOrderStatusUpdateSchema = orderStatusUpdateSchema;

export const activityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(300).optional(),
});

export const deleteOrdersRangeSchema = z
  .object({
    rangeType: z.enum(['yesterday', 'single_day', 'custom_range']),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    roles: z.array(z.enum(['employee', 'captain', 'admin'])).min(1),
    includeTravelOrders: z.boolean().default(true),
    includeDeliveryOrders: z.boolean().default(true),
    includeTravelNotifications: z.boolean().default(true),
    includeDeliveryNotifications: z.boolean().default(true),
    includeActivityLogs: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    if (value.rangeType === 'single_day' && !value.date) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'ڕۆژ پێویستە.', path: ['date'] });
    }

    if (value.rangeType === 'custom_range') {
      if (!value.fromDate) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'fromDate پێویستە.', path: ['fromDate'] });
      }

      if (!value.toDate) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'toDate پێویستە.', path: ['toDate'] });
      }

      if (value.fromDate && value.toDate && value.fromDate > value.toDate) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'دەبێت بەرواری سەرەتا لە کۆتایی گەورەتر نەبێت.', path: ['toDate'] });
      }
    }

    if (!value.includeTravelOrders && !value.includeDeliveryOrders && !value.includeTravelNotifications && !value.includeDeliveryNotifications && !value.includeActivityLogs) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'لانیکەم یەک جۆر داتا هەڵبژێرە.' });
    }
  });

export const importBackupSchema = z.object({
  backup: z.unknown(),
});

export type LoginInput = z.infer<typeof loginInputSchema>;
export type CategoryInput = z.infer<typeof categoryInputSchema>;
export type MenuItemInput = z.infer<typeof menuItemInputSchema>;
export type BusinessSettingsInput = z.infer<typeof businessSettingsInputSchema>;
export type VisibilityInput = z.infer<typeof visibilityInputSchema>;
export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;
export type CreateDeliveryOrderInput = z.infer<typeof createDeliveryOrderInputSchema>;
export type OrderStatusUpdateInput = z.infer<typeof orderStatusUpdateSchema>;
export type DeliveryOrderStatusUpdateInput = z.infer<typeof deliveryOrderStatusUpdateSchema>;
export type DeleteOrdersRangeInput = z.infer<typeof deleteOrdersRangeSchema>;
