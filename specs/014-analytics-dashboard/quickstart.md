# Quickstart: Analytics Dashboard

**Feature**: 014-analytics-dashboard
**Date**: 2026-02-04

---

## Analytics Service

```typescript
// apps/functions/src/services/analyticsService.ts
import { db, FieldValue, Timestamp } from '../lib/firebase';
import { startOfDay, endOfDay, subDays, format, eachDayOfInterval } from 'date-fns';

interface DateRange {
  from: Date;
  to: Date;
}

export async function getAnalyticsOverview(
  clinicId: string,
  range: DateRange,
  compareWithPrevious: boolean = true
) {
  // Get snapshots for the range
  const snapshots = await getSnapshots(clinicId, range);

  // Aggregate
  const current = aggregateSnapshots(snapshots);

  let comparison = null;
  if (compareWithPrevious) {
    const previousRange = getPreviousPeriod(range);
    const previousSnapshots = await getSnapshots(clinicId, previousRange);
    const previous = aggregateSnapshots(previousSnapshots);
    comparison = calculateChanges(current, previous);
  }

  return {
    appointments: {
      total: current.appointments.total,
      change: comparison?.appointments.totalChange ?? null,
    },
    revenue: {
      totalCents: current.revenue.totalCents,
      change: comparison?.revenue.totalChange ?? null,
    },
    patients: {
      new: current.patients.newPatients,
      change: comparison?.patients.newChange ?? null,
    },
    noShowRate: {
      rate: current.appointments.noShowRate,
      change: comparison?.appointments.noShowRateChange ?? null,
    },
  };
}

export async function getAppointmentAnalytics(
  clinicId: string,
  range: DateRange,
  options: { professionalId?: string; serviceId?: string; granularity?: string }
) {
  const snapshots = await getSnapshots(clinicId, range);
  const aggregated = aggregateSnapshots(snapshots);

  // Build time series
  const timeSeries = snapshots.map((s) => ({
    date: s.date,
    total: s.appointments.total,
    completed: s.appointments.byStatus.completed,
    cancelled: s.appointments.byStatus.cancelled,
    noShow: s.appointments.byStatus.no_show,
  }));

  return {
    total: aggregated.appointments.total,
    byStatus: aggregated.appointments.byStatus,
    byProfessional: aggregated.appointments.byProfessional,
    byService: aggregated.appointments.byService,
    byHour: aggregated.appointments.byHour,
    byDayOfWeek: aggregated.appointments.byDayOfWeek,
    timeSeries,
    completionRate: aggregated.appointments.completionRate,
    noShowRate: aggregated.appointments.noShowRate,
    cancellationRate: aggregated.appointments.cancellationRate,
  };
}

export async function getRevenueAnalytics(
  clinicId: string,
  range: DateRange
) {
  const snapshots = await getSnapshots(clinicId, range);
  const aggregated = aggregateSnapshots(snapshots);

  // Build time series
  const timeSeries = snapshots.map((s) => ({
    date: s.date,
    totalCents: s.revenue.totalCents,
    depositsCents: s.revenue.depositsCents,
  }));

  // Project monthly revenue
  const daysInMonth = new Date(range.to.getFullYear(), range.to.getMonth() + 1, 0).getDate();
  const daysElapsed = snapshots.length;
  const dailyAverage = aggregated.revenue.totalCents / daysElapsed;
  const projectedMonthCents = Math.round(dailyAverage * daysInMonth);

  return {
    totalCents: aggregated.revenue.totalCents,
    depositsCents: aggregated.revenue.depositsCents,
    byService: aggregated.revenue.byService,
    byProfessional: aggregated.revenue.byProfessional,
    byPaymentMethod: aggregated.revenue.byPaymentMethod,
    timeSeries,
    averageTicketCents: aggregated.revenue.averageTicketCents,
    projectedMonthCents,
  };
}

async function getSnapshots(
  clinicId: string,
  range: DateRange
): Promise<any[]> {
  const fromStr = format(range.from, 'yyyy-MM-dd');
  const toStr = format(range.to, 'yyyy-MM-dd');

  const snapshot = await db
    .collection('gendei_analytics_snapshots')
    .where('clinicId', '==', clinicId)
    .where('period', '==', 'daily')
    .where('date', '>=', fromStr)
    .where('date', '<=', toStr)
    .orderBy('date', 'asc')
    .get();

  return snapshot.docs.map((doc) => doc.data());
}

function aggregateSnapshots(snapshots: any[]) {
  const result = {
    appointments: {
      total: 0,
      byStatus: {} as Record<string, number>,
      byProfessional: {} as Record<string, number>,
      byService: {} as Record<string, number>,
      byHour: {} as Record<string, number>,
      byDayOfWeek: {} as Record<string, number>,
      completionRate: 0,
      noShowRate: 0,
      cancellationRate: 0,
    },
    revenue: {
      totalCents: 0,
      depositsCents: 0,
      byService: {} as Record<string, number>,
      byProfessional: {} as Record<string, number>,
      byPaymentMethod: {} as Record<string, number>,
      averageTicketCents: 0,
    },
    patients: {
      newPatients: 0,
      returningPatients: 0,
    },
  };

  snapshots.forEach((s) => {
    // Appointments
    result.appointments.total += s.appointments?.total || 0;
    mergeObjects(result.appointments.byStatus, s.appointments?.byStatus);
    mergeObjects(result.appointments.byProfessional, s.appointments?.byProfessional);
    mergeObjects(result.appointments.byService, s.appointments?.byService);
    mergeObjects(result.appointments.byHour, s.appointments?.byHour);
    mergeObjects(result.appointments.byDayOfWeek, s.appointments?.byDayOfWeek);

    // Revenue
    result.revenue.totalCents += s.revenue?.totalCents || 0;
    result.revenue.depositsCents += s.revenue?.depositsCents || 0;
    mergeObjects(result.revenue.byService, s.revenue?.byService);
    mergeObjects(result.revenue.byProfessional, s.revenue?.byProfessional);
    mergeObjects(result.revenue.byPaymentMethod, s.revenue?.byPaymentMethod);

    // Patients
    result.patients.newPatients += s.patients?.newPatients || 0;
    result.patients.returningPatients += s.patients?.returningPatients || 0;
  });

  // Calculate rates
  const completed = result.appointments.byStatus.completed || 0;
  const noShow = result.appointments.byStatus.no_show || 0;
  const cancelled = result.appointments.byStatus.cancelled || 0;
  const total = result.appointments.total;

  if (total > 0) {
    result.appointments.completionRate = completed / total;
    result.appointments.noShowRate = noShow / total;
    result.appointments.cancellationRate = cancelled / total;
    result.revenue.averageTicketCents = Math.round(result.revenue.totalCents / completed);
  }

  return result;
}

function mergeObjects(target: Record<string, number>, source?: Record<string, number>) {
  if (!source) return;
  Object.entries(source).forEach(([key, value]) => {
    target[key] = (target[key] || 0) + value;
  });
}

function getPreviousPeriod(range: DateRange): DateRange {
  const days = Math.ceil((range.to.getTime() - range.from.getTime()) / (1000 * 60 * 60 * 24));
  return {
    from: subDays(range.from, days),
    to: subDays(range.to, days),
  };
}

function calculateChanges(current: any, previous: any) {
  const calcChange = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100);
  };

  return {
    appointments: {
      totalChange: calcChange(current.appointments.total, previous.appointments.total),
      noShowRateChange: current.appointments.noShowRate - previous.appointments.noShowRate,
    },
    revenue: {
      totalChange: calcChange(current.revenue.totalCents, previous.revenue.totalCents),
    },
    patients: {
      newChange: calcChange(current.patients.newPatients, previous.patients.newPatients),
    },
  };
}
```

---

## Scheduled Analytics Aggregation

```typescript
// apps/functions/src/workers/analyticsWorker.ts
import * as functions from 'firebase-functions';
import { db, FieldValue, Timestamp } from '../lib/firebase';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

export const aggregateDailyAnalytics = functions.pubsub
  .schedule('0 1 * * *')  // Run at 1 AM daily
  .timeZone('America/Sao_Paulo')
  .onRun(async () => {
    const yesterday = subDays(new Date(), 1);
    const dateStr = format(yesterday, 'yyyy-MM-dd');

    // Get all active clinics
    const clinicsSnapshot = await db
      .collection('gendei_clinics')
      .where('admin.suspended', '!=', true)
      .get();

    for (const clinicDoc of clinicsSnapshot.docs) {
      await computeDailySnapshot(clinicDoc.id, yesterday, dateStr);
    }
  });

async function computeDailySnapshot(
  clinicId: string,
  date: Date,
  dateStr: string
) {
  const start = startOfDay(date);
  const end = endOfDay(date);

  // Get appointments
  const appointmentsSnapshot = await db
    .collection('gendei_appointments')
    .where('clinicId', '==', clinicId)
    .where('startTime', '>=', Timestamp.fromDate(start))
    .where('startTime', '<=', Timestamp.fromDate(end))
    .get();

  // Get messages
  const messagesSnapshot = await db
    .collection('gendei_messages')
    .where('clinicId', '==', clinicId)
    .where('timestamp', '>=', Timestamp.fromDate(start))
    .where('timestamp', '<=', Timestamp.fromDate(end))
    .get();

  // Get conversations
  const conversationsSnapshot = await db
    .collection('gendei_conversations')
    .where('clinicId', '==', clinicId)
    .where('createdAt', '>=', Timestamp.fromDate(start))
    .where('createdAt', '<=', Timestamp.fromDate(end))
    .get();

  // Compute metrics
  const appointments = computeAppointmentMetrics(appointmentsSnapshot.docs);
  const revenue = computeRevenueMetrics(appointmentsSnapshot.docs);
  const patients = await computePatientMetrics(clinicId, date);
  const ai = computeAIMetrics(messagesSnapshot.docs, conversationsSnapshot.docs);
  const professionals = computeProfessionalMetrics(appointmentsSnapshot.docs);

  // Save snapshot
  const snapshotId = `${clinicId}_${dateStr}_daily`;
  await db.collection('gendei_analytics_snapshots').doc(snapshotId).set({
    clinicId,
    date: dateStr,
    period: 'daily',
    appointments,
    revenue,
    patients,
    professionals,
    ai,
    computedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

function computeAppointmentMetrics(docs: FirebaseFirestore.QueryDocumentSnapshot[]) {
  const byStatus: Record<string, number> = {};
  const byProfessional: Record<string, number> = {};
  const byService: Record<string, number> = {};
  const byHour: Record<string, number> = {};

  let totalDuration = 0;

  docs.forEach((doc) => {
    const data = doc.data();

    // By status
    byStatus[data.status] = (byStatus[data.status] || 0) + 1;

    // By professional
    byProfessional[data.professionalId] = (byProfessional[data.professionalId] || 0) + 1;

    // By service
    byService[data.serviceId] = (byService[data.serviceId] || 0) + 1;

    // By hour
    const hour = data.startTime.toDate().getHours().toString().padStart(2, '0');
    byHour[hour] = (byHour[hour] || 0) + 1;

    // Duration
    totalDuration += data.durationMinutes || 0;
  });

  const total = docs.length;
  const completed = byStatus.completed || 0;
  const noShow = byStatus.no_show || 0;
  const cancelled = byStatus.cancelled || 0;

  return {
    total,
    byStatus,
    byProfessional,
    byService,
    byHour,
    byDayOfWeek: {},
    totalDurationMinutes: totalDuration,
    completionRate: total > 0 ? completed / total : 0,
    noShowRate: total > 0 ? noShow / total : 0,
    cancellationRate: total > 0 ? cancelled / total : 0,
  };
}

function computeRevenueMetrics(docs: FirebaseFirestore.QueryDocumentSnapshot[]) {
  let totalCents = 0;
  let depositsCents = 0;
  const byService: Record<string, number> = {};
  const byProfessional: Record<string, number> = {};
  const byPaymentMethod: Record<string, number> = {};

  docs.forEach((doc) => {
    const data = doc.data();

    if (data.status === 'completed') {
      totalCents += data.priceCents || 0;

      byService[data.serviceId] = (byService[data.serviceId] || 0) + (data.priceCents || 0);
      byProfessional[data.professionalId] = (byProfessional[data.professionalId] || 0) + (data.priceCents || 0);

      const method = data.depositPaymentMethod || 'other';
      byPaymentMethod[method] = (byPaymentMethod[method] || 0) + (data.priceCents || 0);
    }

    if (data.depositPaid) {
      depositsCents += data.depositAmount || 0;
    }
  });

  const completedCount = docs.filter((d) => d.data().status === 'completed').length;

  return {
    totalCents,
    depositsCents,
    pendingCents: 0,
    collectedCents: totalCents,
    byService,
    byProfessional,
    byPaymentMethod,
    averageTicketCents: completedCount > 0 ? Math.round(totalCents / completedCount) : 0,
  };
}

async function computePatientMetrics(clinicId: string, date: Date) {
  // Implementation would query patients collection
  return {
    totalActive: 0,
    newPatients: 0,
    returningPatients: 0,
    uniquePatientsServed: 0,
    averageVisitsPerPatient: 0,
    byAcquisitionChannel: {
      whatsapp: 0,
      whatsapp_flow: 0,
      web: 0,
      manual: 0,
      referral: 0,
    },
  };
}

function computeAIMetrics(
  messageDocs: FirebaseFirestore.QueryDocumentSnapshot[],
  conversationDocs: FirebaseFirestore.QueryDocumentSnapshot[]
) {
  let messagesReceived = 0;
  let messagesHandledByAI = 0;
  let messagesHandledByHuman = 0;
  let handoffs = 0;

  messageDocs.forEach((doc) => {
    const data = doc.data();
    if (data.direction === 'inbound') {
      messagesReceived++;
    }
    if (data.sender === 'ai') {
      messagesHandledByAI++;
    }
    if (data.sender === 'staff') {
      messagesHandledByHuman++;
    }
  });

  return {
    totalConversations: conversationDocs.length,
    messagesReceived,
    messagesHandledByAI,
    messagesHandledByHuman,
    handoffs,
    handoffRate: messagesReceived > 0 ? handoffs / messagesReceived : 0,
    averageResponseTimeSeconds: 0,
    appointmentsBookedByAI: 0,
    appointmentConversionRate: 0,
  };
}

function computeProfessionalMetrics(docs: FirebaseFirestore.QueryDocumentSnapshot[]) {
  const byProfessional: Record<string, any> = {};

  docs.forEach((doc) => {
    const data = doc.data();
    const profId = data.professionalId;

    if (!byProfessional[profId]) {
      byProfessional[profId] = {
        appointments: 0,
        completed: 0,
        cancelled: 0,
        noShow: 0,
        revenueCents: 0,
        totalBookedMinutes: 0,
      };
    }

    byProfessional[profId].appointments++;
    byProfessional[profId].totalBookedMinutes += data.durationMinutes || 0;

    if (data.status === 'completed') {
      byProfessional[profId].completed++;
      byProfessional[profId].revenueCents += data.priceCents || 0;
    }
    if (data.status === 'cancelled') byProfessional[profId].cancelled++;
    if (data.status === 'no_show') byProfessional[profId].noShow++;
  });

  return byProfessional;
}
```

---

## Analytics Dashboard Component

```typescript
// apps/web/src/app/[locale]/dashboard/analytics/page.tsx
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { subDays, startOfMonth, format } from 'date-fns';
import { api } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Calendar, DollarSign, Users, TrendingDown } from 'lucide-react';

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState({
    from: startOfMonth(new Date()),
    to: new Date(),
  });

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['analytics', 'overview', dateRange],
    queryFn: () =>
      api
        .get('/analytics/overview', {
          params: {
            from: format(dateRange.from, 'yyyy-MM-dd'),
            to: format(dateRange.to, 'yyyy-MM-dd'),
          },
        })
        .then((r) => r.data),
  });

  const { data: appointments } = useQuery({
    queryKey: ['analytics', 'appointments', dateRange],
    queryFn: () =>
      api
        .get('/analytics/appointments', {
          params: {
            from: format(dateRange.from, 'yyyy-MM-dd'),
            to: format(dateRange.to, 'yyyy-MM-dd'),
          },
        })
        .then((r) => r.data),
  });

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          title="Consultas"
          value={overview?.appointments.total || 0}
          change={overview?.appointments.change}
          icon={<Calendar className="h-4 w-4" />}
        />
        <MetricCard
          title="Receita"
          value={formatPrice(overview?.revenue.totalCents || 0)}
          change={overview?.revenue.change}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <MetricCard
          title="Novos Pacientes"
          value={overview?.patients.new || 0}
          change={overview?.patients.change}
          icon={<Users className="h-4 w-4" />}
        />
        <MetricCard
          title="Taxa de Faltas"
          value={`${((overview?.noShowRate.rate || 0) * 100).toFixed(1)}%`}
          change={overview?.noShowRate.change}
          icon={<TrendingDown className="h-4 w-4" />}
          invertChange
        />
      </div>

      {/* Appointments Over Time */}
      <Card>
        <CardHeader>
          <CardTitle>Consultas ao Longo do Tempo</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={appointments?.timeSeries || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="total" stroke="#8884d8" name="Total" />
              <Line type="monotone" dataKey="completed" stroke="#82ca9d" name="Completadas" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* By Status */}
        <Card>
          <CardHeader>
            <CardTitle>Por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={Object.entries(appointments?.byStatus || {}).map(([name, value]) => ({
                    name,
                    value,
                  }))}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label
                >
                  {Object.keys(appointments?.byStatus || {}).map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* By Service */}
        <Card>
          <CardHeader>
            <CardTitle>Por Serviço</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                data={Object.entries(appointments?.byService || {}).map(([name, value]) => ({
                  name,
                  value,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  change,
  icon,
  invertChange = false,
}: {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  invertChange?: boolean;
}) {
  const isPositive = invertChange ? (change || 0) < 0 : (change || 0) > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change !== undefined && change !== null && (
          <p className={`text-xs ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
            {change > 0 ? '+' : ''}{change}% vs período anterior
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```
