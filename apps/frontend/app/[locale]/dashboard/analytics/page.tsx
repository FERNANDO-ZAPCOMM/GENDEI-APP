'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import {
  BarChart3,
  TrendingUp,
  CreditCard,
  Receipt,
  Wallet,
  Percent,
} from 'lucide-react';

import { useClinic, useClinicStats } from '@/hooks/use-clinic';
import { usePayments } from '@/hooks/use-payments';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

function isPaidStatus(status: string): boolean {
  const normalized = (status || '').toLowerCase();
  return normalized === 'paid' || normalized === 'completed';
}

function toIsoDate(raw?: string | Date | Record<string, unknown>): string | null {
  if (!raw) return null;
  if (raw instanceof Date) return raw.toISOString();
  if (typeof raw === 'string') {
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  if (typeof raw === 'object') {
    const maybe = raw as {
      toDate?: () => Date;
      seconds?: number;
      _seconds?: number;
      nanoseconds?: number;
      _nanoseconds?: number;
    };
    if (typeof maybe.toDate === 'function') {
      const parsed = maybe.toDate();
      return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    }
    const seconds = maybe.seconds ?? maybe._seconds;
    const nanos = maybe.nanoseconds ?? maybe._nanoseconds ?? 0;
    if (typeof seconds === 'number') {
      const parsed = new Date(seconds * 1000 + Math.floor(nanos / 1e6));
      return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    }
  }
  return null;
}

export default function AnalyticsPage() {
  const t = useTranslations();
  const params = useParams();
  const { currentClinic, isLoading: clinicLoading } = useClinic();
  const { data: stats, isLoading: statsLoading } = useClinicStats(currentClinic?.id || '');
  const { data: payments = [], isLoading: paymentsLoading } = usePayments(currentClinic?.id || '');

  const locale = (params?.locale as string) || 'pt-BR';
  const currency = 'BRL';

  const analytics = useMemo(() => {
    const paidTransactions = payments.filter((payment) => isPaidStatus(payment.paymentStatus));
    const totalTransactions = payments.length;
    const paidTransactionsCount = paidTransactions.length;

    const totalRevenueCents = paidTransactions.reduce((sum, payment) => sum + (payment.amountCents || 0), 0);
    const averageTicketCents = paidTransactionsCount > 0 ? Math.round(totalRevenueCents / paidTransactionsCount) : 0;
    const conversionRate = totalTransactions > 0 ? (paidTransactionsCount / totalTransactions) * 100 : 0;

    const methodStats = paidTransactions.reduce(
      (acc, payment) => {
        const method = (payment.paymentMethod || 'other').toLowerCase();
        const amount = payment.amountCents || 0;
        if (method === 'pix') {
          acc.pixCount += 1;
          acc.pixRevenueCents += amount;
        } else if (method === 'card') {
          acc.cardCount += 1;
          acc.cardRevenueCents += amount;
        } else {
          acc.otherCount += 1;
          acc.otherRevenueCents += amount;
        }
        return acc;
      },
      {
        pixCount: 0,
        pixRevenueCents: 0,
        cardCount: 0,
        cardRevenueCents: 0,
        otherCount: 0,
        otherRevenueCents: 0,
      }
    );

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthlyPaidRevenueCents = paidTransactions.reduce((sum, payment) => {
      const iso = toIsoDate(payment.paidAt || payment.updatedAt || payment.createdAt);
      if (!iso) return sum;
      const date = new Date(iso);
      if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
        return sum + (payment.amountCents || 0);
      }
      return sum;
    }, 0);

    return {
      totalTransactions,
      paidTransactionsCount,
      totalRevenueCents,
      averageTicketCents,
      conversionRate,
      methodStats,
      monthlyPaidRevenueCents,
    };
  }, [payments]);

  const formatCurrency = (valueCents: number) =>
    (valueCents / 100).toLocaleString(locale, { style: 'currency', currency });

  const maxMethodRevenue = Math.max(
    analytics.methodStats.pixRevenueCents,
    analytics.methodStats.cardRevenueCents,
    analytics.methodStats.otherRevenueCents,
    1
  );

  if (clinicLoading || statsLoading || paymentsLoading) {
    return (
      <div className="space-y-6 page-transition">
        <Skeleton className="h-9 w-56" />
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <div className="grid gap-4 grid-cols-1 xl:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 page-transition">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{t('analyticsPage.title')}</h1>
        <p className="text-gray-600 mt-1">{t('analyticsPage.description')}</p>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-l-4 border-l-green-500 bg-gradient-to-br from-green-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-green-700 font-medium">{t('analyticsPage.cards.totalRevenue')}</p>
                <p className="text-2xl font-bold text-green-800">{formatCurrency(analytics.totalRevenueCents)}</p>
              </div>
              <Wallet className="w-5 h-5 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-blue-700 font-medium">{t('analyticsPage.cards.monthRevenue')}</p>
                <p className="text-2xl font-bold text-blue-800">{formatCurrency(analytics.monthlyPaidRevenueCents)}</p>
              </div>
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-violet-500 bg-gradient-to-br from-violet-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-violet-700 font-medium">{t('analyticsPage.cards.averageTicket')}</p>
                <p className="text-2xl font-bold text-violet-800">{formatCurrency(analytics.averageTicketCents)}</p>
              </div>
              <Receipt className="w-5 h-5 text-violet-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 bg-gradient-to-br from-amber-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-amber-700 font-medium">{t('analyticsPage.cards.conversion')}</p>
                <p className="text-2xl font-bold text-amber-800">
                  {analytics.conversionRate.toLocaleString(locale, { maximumFractionDigits: 1 })}%
                </p>
              </div>
              <Percent className="w-5 h-5 text-amber-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 grid-cols-1 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="w-4 h-4" />
              {t('analyticsPage.methodBreakdown.title')}
            </CardTitle>
            <CardDescription>{t('analyticsPage.methodBreakdown.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span>PIX</span>
                <span className="text-muted-foreground">
                  {analytics.methodStats.pixCount} • {formatCurrency(analytics.methodStats.pixRevenueCents)}
                </span>
              </div>
              <Progress value={(analytics.methodStats.pixRevenueCents / maxMethodRevenue) * 100} />
            </div>

            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span>{t('analyticsPage.methodBreakdown.card')}</span>
                <span className="text-muted-foreground">
                  {analytics.methodStats.cardCount} • {formatCurrency(analytics.methodStats.cardRevenueCents)}
                </span>
              </div>
              <Progress value={(analytics.methodStats.cardRevenueCents / maxMethodRevenue) * 100} />
            </div>

            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span>{t('analyticsPage.methodBreakdown.other')}</span>
                <span className="text-muted-foreground">
                  {analytics.methodStats.otherCount} • {formatCurrency(analytics.methodStats.otherRevenueCents)}
                </span>
              </div>
              <Progress value={(analytics.methodStats.otherRevenueCents / maxMethodRevenue) * 100} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="w-4 h-4" />
              {t('analyticsPage.transactions.title')}
            </CardTitle>
            <CardDescription>{t('analyticsPage.transactions.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm text-muted-foreground">{t('analyticsPage.transactions.total')}</span>
              <Badge variant="secondary">{analytics.totalTransactions}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm text-muted-foreground">{t('analyticsPage.transactions.paid')}</span>
              <Badge className="bg-green-600">{analytics.paidTransactionsCount}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm text-muted-foreground">{t('analyticsPage.transactions.todayAppointments')}</span>
              <Badge variant="outline">{stats?.todayAppointments || 0}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm text-muted-foreground">{t('analyticsPage.transactions.totalPatients')}</span>
              <Badge variant="outline">{stats?.totalPatients || 0}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
