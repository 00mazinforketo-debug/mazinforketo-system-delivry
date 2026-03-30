import type { EmployeeActivityDaySummary, EmployeeActivityReport, EmployeeActivitySummary, Order, UserSummary } from '../../../shared/models';
import { getBusinessDayKey } from '../../../shared/business-time';

const getMinutesBetween = (startAt: string, endAt: string) =>
  Math.max(0, Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000));

const sortByCreatedAtAsc = (left: Order, right: Order) => left.createdAt.localeCompare(right.createdAt);

const buildDaySummary = (dayKey: string, orders: Order[]): EmployeeActivityDaySummary => {
  const sorted = [...orders].sort(sortByCreatedAtAsc);
  const firstOrderAt = sorted[0]?.createdAt ?? null;
  const lastOrderAt = sorted.at(-1)?.createdAt ?? null;

  return {
    dayKey,
    orderCount: sorted.length,
    firstOrderAt,
    lastOrderAt,
    estimatedWorkMinutes: firstOrderAt && lastOrderAt ? getMinutesBetween(firstOrderAt, lastOrderAt) : 0,
    totalSales: sorted.filter((order) => order.status !== 'cancelled').reduce((sum, order) => sum + order.total, 0),
  };
};

const buildEmployeeSummary = (employee: UserSummary, orders: Order[]): EmployeeActivitySummary => {
  const relevantOrders = orders
    .filter((order) => order.createdByRole === 'employee' && order.createdByName === employee.displayName)
    .sort(sortByCreatedAtAsc);

  const daysMap = relevantOrders.reduce<Record<string, Order[]>>((groups, order) => {
    const dayKey = getBusinessDayKey(order.createdAt);
    groups[dayKey] = [...(groups[dayKey] ?? []), order];
    return groups;
  }, {});

  const days = Object.entries(daysMap)
    .map(([dayKey, dayOrders]) => buildDaySummary(dayKey, dayOrders))
    .sort((left, right) => right.dayKey.localeCompare(left.dayKey));

  const totalOrders = relevantOrders.length;
  const activeDays = days.length;
  const estimatedWorkMinutes = days.reduce((sum, day) => sum + day.estimatedWorkMinutes, 0);
  const totalSales = relevantOrders.filter((order) => order.status !== 'cancelled').reduce((sum, order) => sum + order.total, 0);
  const averageOrdersPerDay = activeDays === 0 ? 0 : totalOrders / activeDays;
  const busiestDay =
    [...days].sort((left, right) => right.orderCount - left.orderCount || right.estimatedWorkMinutes - left.estimatedWorkMinutes)[0] ?? null;

  return {
    displayName: employee.displayName,
    totalOrders,
    activeDays,
    estimatedWorkMinutes,
    totalSales,
    firstOrderAt: relevantOrders[0]?.createdAt ?? null,
    lastOrderAt: relevantOrders.at(-1)?.createdAt ?? null,
    completedOrders: relevantOrders.filter((order) => order.status === 'completed').length,
    acceptedOrders: relevantOrders.filter((order) => order.status === 'accepted').length,
    pendingOrders: relevantOrders.filter((order) => order.status === 'pending_captain').length,
    cancelledOrders: relevantOrders.filter((order) => order.status === 'cancelled').length,
    averageOrdersPerDay,
    days,
    busiestDay,
  };
};

const sortEmployees = (left: EmployeeActivitySummary, right: EmployeeActivitySummary) =>
  right.totalOrders - left.totalOrders ||
  right.estimatedWorkMinutes - left.estimatedWorkMinutes ||
  (right.lastOrderAt ?? '').localeCompare(left.lastOrderAt ?? '') ||
  left.displayName.localeCompare(right.displayName);

export const buildEmployeeActivityReport = (
  employeeUsers: UserSummary[],
  orders: Order[],
): EmployeeActivityReport => {
  const employees = employeeUsers
    .filter((employee) => employee.role === 'employee')
    .map((employee) => buildEmployeeSummary(employee, orders));
  const rankedEmployees = [...employees].sort(sortEmployees);
  const topPerformer = rankedEmployees[0]?.totalOrders ? rankedEmployees[0] : null;

  return {
    employees,
    rankedEmployees,
    totalEmployeeOrders: employees.reduce((sum, employee) => sum + employee.totalOrders, 0),
    totalEstimatedWorkMinutes: employees.reduce((sum, employee) => sum + employee.estimatedWorkMinutes, 0),
    activeEmployeeCount: employees.filter((employee) => employee.totalOrders > 0).length,
    topPerformer,
  };
};
