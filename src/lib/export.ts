import type { BackupPayload, Order } from '../types/models';

export const downloadTextFile = (content: string, fileName: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

const escapeCsvValue = (value: string | number) => {
  const stringValue = String(value).replace(/"/g, '""');
  return `"${stringValue}"`;
};

export const ordersToCsv = (orders: Order[]) => {
  const headers = [
    'orderNumber',
    'customerName',
    'mobileNumber',
    'province',
    'status',
    'total',
    'createdByName',
    'createdAt',
    'updatedAt',
  ];

  const rows = orders.map((order) =>
    [
      order.orderNumber,
      order.customerName,
      order.mobileNumber,
      order.province,
      order.status,
      order.total,
      order.createdByName,
      order.createdAt,
      order.updatedAt,
    ]
      .map(escapeCsvValue)
      .join(','),
  );

  return [headers.join(','), ...rows].join('\n');
};

export const backupToJson = (backup: BackupPayload) => JSON.stringify(backup, null, 2);
