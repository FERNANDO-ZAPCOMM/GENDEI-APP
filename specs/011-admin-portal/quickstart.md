# Quickstart: Admin Portal

**Feature**: 011-admin-portal
**Date**: 2026-02-04

---

## Admin Auth Middleware

```typescript
// apps/admin/src/middleware/adminAuth.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';

export async function adminAuthMiddleware(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);

    // Check admin claims
    if (!decodedToken.admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Add admin info to request
    req.headers.set('x-admin-id', decodedToken.uid);
    req.headers.set('x-admin-role', decodedToken.adminRole);
    req.headers.set('x-admin-permissions', JSON.stringify(decodedToken.permissions || []));

    return NextResponse.next();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
}

// Permission check helper
export function requirePermission(permission: string) {
  return (req: NextRequest) => {
    const permissions = JSON.parse(req.headers.get('x-admin-permissions') || '[]');
    if (!permissions.includes(permission)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }
    return null;
  };
}
```

---

## Clinic Management Controller

```typescript
// apps/functions/src/controllers/admin/clinicAdminController.ts
import { db, FieldValue } from '../../lib/firebase';
import { createAuditLog } from '../../services/auditService';

export async function listClinics(req: Request, res: Response) {
  const { status, plan, search, sortBy = 'createdAt', sortOrder = 'desc', limit = 50, cursor } = req.query;

  let query = db.collection('gendei_clinics').orderBy(sortBy as string, sortOrder as 'asc' | 'desc');

  if (status && status !== 'all') {
    if (status === 'suspended') {
      query = query.where('admin.suspended', '==', true);
    } else {
      query = query.where('subscription.status', '==', status);
    }
  }

  if (plan && plan !== 'all') {
    query = query.where('subscription.plan', '==', plan);
  }

  if (cursor) {
    const cursorDoc = await db.collection('gendei_clinics').doc(cursor as string).get();
    query = query.startAfter(cursorDoc);
  }

  query = query.limit(Number(limit) + 1);

  const snapshot = await query.get();
  const clinics = snapshot.docs.slice(0, Number(limit)).map((doc) => ({
    id: doc.id,
    ...formatClinicForAdmin(doc.data()),
  }));

  const hasMore = snapshot.docs.length > Number(limit);
  const nextCursor = hasMore ? snapshot.docs[Number(limit) - 1].id : null;

  // Search filter (in-memory for simplicity, could use Algolia)
  let filteredClinics = clinics;
  if (search) {
    const searchLower = (search as string).toLowerCase();
    filteredClinics = clinics.filter(
      (c) =>
        c.name.toLowerCase().includes(searchLower) ||
        c.ownerEmail.toLowerCase().includes(searchLower) ||
        c.phone?.includes(search as string)
    );
  }

  return res.json({
    clinics: filteredClinics,
    nextCursor,
    totalCount: filteredClinics.length,
  });
}

export async function getClinicDetail(req: Request, res: Response) {
  const { clinicId } = req.params;

  const clinicDoc = await db.collection('gendei_clinics').doc(clinicId).get();

  if (!clinicDoc.exists) {
    return res.status(404).json({ error: 'Clinic not found' });
  }

  // Get additional data
  const [professionals, appointments, messages] = await Promise.all([
    db.collection('gendei_clinics').doc(clinicId).collection('professionals').get(),
    db.collection('gendei_appointments').where('clinicId', '==', clinicId).limit(10).get(),
    db.collection('gendei_messages').where('clinicId', '==', clinicId).limit(10).get(),
  ]);

  return res.json({
    ...formatClinicDetailForAdmin(clinicDoc.data()!),
    id: clinicId,
    professionalsCount: professionals.size,
    recentAppointments: appointments.docs.map((d) => ({ id: d.id, ...d.data() })),
    recentMessages: messages.docs.map((d) => ({ id: d.id, ...d.data() })),
  });
}

export async function suspendClinic(req: Request, res: Response) {
  const adminId = req.headers.get('x-admin-id')!;
  const { clinicId } = req.params;
  const { reason, notifyOwner = true } = req.body;

  const clinicRef = db.collection('gendei_clinics').doc(clinicId);
  const clinicDoc = await clinicRef.get();

  if (!clinicDoc.exists) {
    return res.status(404).json({ error: 'Clinic not found' });
  }

  await clinicRef.update({
    'admin.suspended': true,
    'admin.suspendedAt': FieldValue.serverTimestamp(),
    'admin.suspendedBy': adminId,
    'admin.suspendedReason': reason,
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Create audit log
  await createAuditLog({
    actorId: adminId,
    action: 'suspend',
    resource: 'clinic',
    resourceId: clinicId,
    description: `Suspended clinic: ${reason}`,
    changes: [{ field: 'admin.suspended', oldValue: false, newValue: true }],
  });

  // Notify owner if requested
  if (notifyOwner) {
    // Send email notification
  }

  return res.json({ success: true });
}

export async function unsuspendClinic(req: Request, res: Response) {
  const adminId = req.headers.get('x-admin-id')!;
  const { clinicId } = req.params;

  const clinicRef = db.collection('gendei_clinics').doc(clinicId);

  await clinicRef.update({
    'admin.suspended': false,
    'admin.suspendedAt': FieldValue.delete(),
    'admin.suspendedBy': FieldValue.delete(),
    'admin.suspendedReason': FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await createAuditLog({
    actorId: adminId,
    action: 'unsuspend',
    resource: 'clinic',
    resourceId: clinicId,
    description: 'Unsuspended clinic',
    changes: [{ field: 'admin.suspended', oldValue: true, newValue: false }],
  });

  return res.json({ success: true });
}

function formatClinicForAdmin(data: any) {
  return {
    name: data.name,
    ownerEmail: data.ownerEmail,
    phone: data.phone,
    subscriptionPlan: data.subscription?.plan || 'trial',
    subscriptionStatus: data.subscription?.status || 'trial',
    suspended: data.admin?.suspended || false,
    verified: data.admin?.verified || false,
    appointmentsThisMonth: data.quotas?.monthlyAppointments?.used || 0,
    messagesThisMonth: data.quotas?.monthlyMessages?.used || 0,
    createdAt: data.createdAt,
    lastActiveAt: data.lastActiveAt,
  };
}

function formatClinicDetailForAdmin(data: any) {
  return {
    ...data,
    // Remove sensitive data
    whatsappConnection: data.whatsappConnection
      ? {
          connected: data.whatsappConnection.connected,
          phoneNumber: data.whatsappConnection.phoneNumber,
          connectedAt: data.whatsappConnection.connectedAt,
        }
      : null,
  };
}
```

---

## Impersonation Service

```typescript
// apps/functions/src/services/impersonationService.ts
import { db, FieldValue, Timestamp } from '../lib/firebase';
import { createAuditLog } from './auditService';
import { randomBytes } from 'crypto';

const IMPERSONATION_EXPIRY_MINUTES = 60;

export async function startImpersonation(
  adminId: string,
  adminEmail: string,
  clinicId: string,
  reason: string,
  durationMinutes: number = IMPERSONATION_EXPIRY_MINUTES
): Promise<{ sessionId: string; token: string; expiresAt: Date }> {
  // Verify clinic exists
  const clinicDoc = await db.collection('gendei_clinics').doc(clinicId).get();
  if (!clinicDoc.exists) {
    throw new Error('Clinic not found');
  }

  // Generate session token
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

  // Create session
  const sessionRef = await db.collection('gendei_impersonation_sessions').add({
    adminId,
    adminEmail,
    clinicId,
    clinicName: clinicDoc.data()!.name,
    token: hashToken(token),
    startedAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromDate(expiresAt),
    reason,
    actionsPerformed: [],
  });

  // Audit log
  await createAuditLog({
    actorId: adminId,
    action: 'impersonate',
    resource: 'clinic',
    resourceId: clinicId,
    description: `Started impersonation session: ${reason}`,
    metadata: { sessionId: sessionRef.id, durationMinutes },
  });

  return {
    sessionId: sessionRef.id,
    token,
    expiresAt,
  };
}

export async function validateImpersonationToken(token: string): Promise<{
  adminId: string;
  clinicId: string;
  sessionId: string;
} | null> {
  const hashedToken = hashToken(token);

  const sessionsQuery = await db
    .collection('gendei_impersonation_sessions')
    .where('token', '==', hashedToken)
    .where('expiresAt', '>', Timestamp.now())
    .where('endedAt', '==', null)
    .limit(1)
    .get();

  if (sessionsQuery.empty) {
    return null;
  }

  const session = sessionsQuery.docs[0];
  return {
    adminId: session.data().adminId,
    clinicId: session.data().clinicId,
    sessionId: session.id,
  };
}

export async function logImpersonationAction(
  sessionId: string,
  action: string,
  resource: string
) {
  await db
    .collection('gendei_impersonation_sessions')
    .doc(sessionId)
    .update({
      actionsPerformed: FieldValue.arrayUnion({
        action,
        resource,
        timestamp: Timestamp.now(),
      }),
    });
}

export async function endImpersonation(sessionId: string) {
  await db.collection('gendei_impersonation_sessions').doc(sessionId).update({
    endedAt: FieldValue.serverTimestamp(),
  });
}

function hashToken(token: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(token).digest('hex');
}
```

---

## Platform Analytics Service

```typescript
// apps/functions/src/services/platformAnalyticsService.ts
import { db, FieldValue } from '../lib/firebase';

export async function getPlatformOverview(): Promise<PlatformOverview> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Get clinic counts
  const [allClinics, activeClinics, newClinics] = await Promise.all([
    db.collection('gendei_clinics').count().get(),
    db
      .collection('gendei_clinics')
      .where('lastActiveAt', '>=', thirtyDaysAgo)
      .count()
      .get(),
    db
      .collection('gendei_clinics')
      .where('createdAt', '>=', thisMonthStart)
      .count()
      .get(),
  ]);

  // Get appointment counts
  const appointmentsThisMonth = await db
    .collection('gendei_appointments')
    .where('createdAt', '>=', thisMonthStart)
    .count()
    .get();

  // Get message counts
  const messagesThisMonth = await db
    .collection('gendei_messages')
    .where('createdAt', '>=', thisMonthStart)
    .count()
    .get();

  // Calculate MRR (simplified - sum of active subscriptions)
  const activeSubscriptions = await db
    .collection('gendei_clinics')
    .where('subscription.status', '==', 'active')
    .get();

  let mrr = 0;
  const planPrices: Record<string, number> = {
    starter: 9900,
    professional: 19900,
    enterprise: 49900,
  };

  activeSubscriptions.docs.forEach((doc) => {
    const plan = doc.data().subscription?.plan;
    mrr += planPrices[plan] || 0;
  });

  return {
    totalClinics: allClinics.data().count,
    activeClinicLast30Days: activeClinics.data().count,
    newClinicsThisMonth: newClinics.data().count,
    churnedClinicsThisMonth: 0, // Would need to track cancellations
    totalAppointmentsThisMonth: appointmentsThisMonth.data().count,
    appointmentsGrowth: 0, // Would compare to previous month
    totalMessagesThisMonth: messagesThisMonth.data().count,
    aiResponseRate: 0, // Would calculate from message types
    mrr,
    arr: mrr * 12,
    averageRevenuePerClinic: mrr / (activeSubscriptions.size || 1),
  };
}

export async function aggregateDailyAnalytics(date: Date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const dateStr = date.toISOString().split('T')[0];

  // Aggregate clinic metrics
  const newClinics = await db
    .collection('gendei_clinics')
    .where('createdAt', '>=', startOfDay)
    .where('createdAt', '<=', endOfDay)
    .get();

  // Aggregate appointment metrics
  const appointments = await db
    .collection('gendei_appointments')
    .where('createdAt', '>=', startOfDay)
    .where('createdAt', '<=', endOfDay)
    .get();

  let appointmentStats = {
    total: 0,
    completed: 0,
    cancelled: 0,
    noShow: 0,
  };

  appointments.docs.forEach((doc) => {
    const status = doc.data().status;
    appointmentStats.total++;
    if (status === 'completed') appointmentStats.completed++;
    if (status === 'cancelled') appointmentStats.cancelled++;
    if (status === 'no_show') appointmentStats.noShow++;
  });

  // Aggregate message metrics
  const messages = await db
    .collection('gendei_messages')
    .where('createdAt', '>=', startOfDay)
    .where('createdAt', '<=', endOfDay)
    .get();

  let messageStats = {
    total: 0,
    inbound: 0,
    outbound: 0,
    aiResponses: 0,
    humanResponses: 0,
  };

  messages.docs.forEach((doc) => {
    messageStats.total++;
    if (doc.data().direction === 'inbound') messageStats.inbound++;
    if (doc.data().direction === 'outbound') messageStats.outbound++;
    if (doc.data().sender === 'ai') messageStats.aiResponses++;
    if (doc.data().sender === 'staff') messageStats.humanResponses++;
  });

  // Save analytics
  await db.collection('gendei_platform_analytics').doc(dateStr).set(
    {
      date: dateStr,
      clinics: {
        new: newClinics.size,
      },
      appointments: appointmentStats,
      messages: messageStats,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}
```

---

## Admin Dashboard Page

```typescript
// apps/admin/src/app/dashboard/page.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { adminApi } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import {
  Building2,
  Calendar,
  MessageSquare,
  TrendingUp,
} from 'lucide-react';

export default function AdminDashboard() {
  const { data: overview, isLoading } = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: () => adminApi.get('/admin/analytics/overview').then((r) => r.data),
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Clínicas</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.totalClinics}</div>
            <p className="text-xs text-muted-foreground">
              {overview.newClinicsThisMonth} novas este mês
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Agendamentos</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overview.totalAppointmentsThisMonth}
            </div>
            <p className="text-xs text-muted-foreground">Este mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Mensagens</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overview.totalMessagesThisMonth}
            </div>
            <p className="text-xs text-muted-foreground">Este mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">MRR</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(overview.mrr)}</div>
            <p className="text-xs text-muted-foreground">
              ARR: {formatPrice(overview.arr)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Additional sections: charts, recent activity, etc. */}
    </div>
  );
}
```

---

## Audit Log Service

```typescript
// apps/functions/src/services/auditService.ts
import { db, FieldValue } from '../lib/firebase';

interface AuditLogInput {
  actorId: string;
  action: string;
  resource: string;
  resourceId?: string;
  description: string;
  changes?: { field: string; oldValue: any; newValue: any }[];
  metadata?: Record<string, any>;
}

export async function createAuditLog(input: AuditLogInput) {
  // Get actor details
  const adminDoc = await db.collection('gendei_admin_users').doc(input.actorId).get();
  const adminData = adminDoc.data();

  await db.collection('gendei_audit_logs').add({
    ...input,
    actorEmail: adminData?.email || 'unknown',
    actorRole: adminData?.role || 'unknown',
    timestamp: FieldValue.serverTimestamp(),
  });
}

export async function getAuditLogs(filters: {
  actorId?: string;
  resource?: string;
  action?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}) {
  let query = db.collection('gendei_audit_logs').orderBy('timestamp', 'desc');

  if (filters.actorId) {
    query = query.where('actorId', '==', filters.actorId);
  }
  if (filters.resource) {
    query = query.where('resource', '==', filters.resource);
  }
  if (filters.action) {
    query = query.where('action', '==', filters.action);
  }
  if (filters.from) {
    query = query.where('timestamp', '>=', filters.from);
  }
  if (filters.to) {
    query = query.where('timestamp', '<=', filters.to);
  }

  query = query.limit(filters.limit || 100);

  const snapshot = await query.get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}
```
