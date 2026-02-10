import { Router, Request, Response } from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import { verifyAuth } from '../middleware/auth';

const router = Router();
const db = getFirestore();
const CLINICS = 'gendei_clinics';
const STRIPE_API_BASE = 'https://api.stripe.com/v1';

interface StripeConnectState {
  accountId?: string;
  onboardingComplete?: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
  country?: string;
  defaultCurrency?: string;
  updatedAt?: string;
}

function removeUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}

function requireStripeSecret(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('Stripe is not configured (missing STRIPE_SECRET_KEY)');
  }
  return key;
}

function getStripeClientId(): string {
  return process.env.STRIPE_CONNECT_CLIENT_ID || '';
}

function getFrontendBaseUrl(): string {
  return process.env.GENDEI_FRONTEND_URL || 'https://nutri.gendei.app';
}

function sanitizeFrontendBaseUrl(value?: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

function getStripeReturnUrl(frontendBaseUrl?: string): string {
  const base = sanitizeFrontendBaseUrl(frontendBaseUrl) || getFrontendBaseUrl();
  return `${base}/pt-BR/dashboard/payments?stripe=success`;
}

function getStripeRefreshUrl(frontendBaseUrl?: string): string {
  const base = sanitizeFrontendBaseUrl(frontendBaseUrl) || getFrontendBaseUrl();
  return `${base}/pt-BR/dashboard/payments?stripe=refresh`;
}

function toDateIso(value: unknown): string {
  const nowIso = new Date().toISOString();
  if (!value) return nowIso;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? nowIso : parsed.toISOString();
  }
  if (typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? nowIso : parsed.toISOString();
  }
  if (typeof value === 'object' && value !== null) {
    const maybeTimestamp = value as {
      toDate?: () => Date;
      seconds?: number;
      _seconds?: number;
      nanoseconds?: number;
      _nanoseconds?: number;
    };

    if (typeof maybeTimestamp.toDate === 'function') {
      const parsed = maybeTimestamp.toDate();
      return Number.isNaN(parsed.getTime()) ? nowIso : parsed.toISOString();
    }

    const secondsRaw = maybeTimestamp.seconds ?? maybeTimestamp._seconds;
    const nanosecondsRaw = maybeTimestamp.nanoseconds ?? maybeTimestamp._nanoseconds;
    if (typeof secondsRaw === 'number') {
      const millis = secondsRaw * 1000 + (typeof nanosecondsRaw === 'number' ? Math.floor(nanosecondsRaw / 1e6) : 0);
      const parsed = new Date(millis);
      return Number.isNaN(parsed.getTime()) ? nowIso : parsed.toISOString();
    }
  }

  return nowIso;
}

async function stripeRequest<T>(
  path: string,
  init: { method?: 'GET' | 'POST'; body?: URLSearchParams } = {}
): Promise<T> {
  const secret = requireStripeSecret();
  const method = init.method || 'GET';

  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secret}`,
      ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: method === 'POST' ? init.body?.toString() : undefined,
  });

  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const stripeError = data.error as { message?: string } | undefined;
    throw new Error(stripeError?.message || `Stripe request failed (${response.status})`);
  }

  return data as T;
}

async function createStripeExpressAccount(clinicId: string): Promise<{ id: string }> {
  const body = new URLSearchParams({
    type: 'express',
    country: 'BR',
  });
  body.append('capabilities[card_payments][requested]', 'true');
  body.append('capabilities[transfers][requested]', 'true');
  body.append('metadata[clinicId]', clinicId);

  return stripeRequest<{ id: string }>('/accounts', { method: 'POST', body });
}

async function createStripeAccountLink(
  accountId: string,
  frontendBaseUrl?: string
): Promise<{ url: string }> {
  const body = new URLSearchParams({
    account: accountId,
    type: 'account_onboarding',
    refresh_url: getStripeRefreshUrl(frontendBaseUrl),
    return_url: getStripeReturnUrl(frontendBaseUrl),
  });

  return stripeRequest<{ url: string }>('/account_links', { method: 'POST', body });
}

async function fetchStripeAccount(
  accountId: string
): Promise<{
  id: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  country?: string;
  default_currency?: string;
}> {
  return stripeRequest(`/accounts/${accountId}`);
}

function mapStripeStateFromClinic(data: Record<string, unknown> | undefined): StripeConnectState {
  const paymentSettings = (data?.paymentSettings || {}) as Record<string, unknown>;
  const stripeConnect = (paymentSettings.stripeConnect || {}) as Record<string, unknown>;

  return {
    accountId: typeof stripeConnect.accountId === 'string' ? stripeConnect.accountId : undefined,
    onboardingComplete: Boolean(stripeConnect.onboardingComplete),
    chargesEnabled: Boolean(stripeConnect.chargesEnabled),
    payoutsEnabled: Boolean(stripeConnect.payoutsEnabled),
    detailsSubmitted: Boolean(stripeConnect.detailsSubmitted),
    country: typeof stripeConnect.country === 'string' ? stripeConnect.country : undefined,
    defaultCurrency:
      typeof stripeConnect.defaultCurrency === 'string'
        ? stripeConnect.defaultCurrency
        : undefined,
    updatedAt: toDateIso(stripeConnect.updatedAt),
  };
}

// GET /payments/clinic/:clinicId
router.get('/clinic/:clinicId', verifyAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const clinicId = req.params.clinicId;
    const limit = Math.min(parseInt(String(req.query.limit || '200'), 10) || 200, 500);

    if (user?.clinicId !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const snapshot = await db
      .collection(CLINICS)
      .doc(clinicId)
      .collection('orders')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const payments = snapshot.docs.map((doc) => {
      const data = doc.data() as Record<string, any>;
      return {
        id: doc.id,
        clinicId,
        appointmentId: data.appointmentId || '',
        patientPhone: data.patientPhone || '',
        patientName: data.patientName || '',
        amountCents: data.amountCents || 0,
        paymentStatus: data.paymentStatus || data.status || 'pending',
        paymentMethod: data.paymentMethod || 'pix',
        paymentSource: data.paymentSource || data.provider || 'pagseguro',
        transferMode: data.transferMode || (data.paymentMethod === 'card' ? 'automatic' : 'manual'),
        paymentId: data.paymentId || '',
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null,
        paidAt: data.paidAt || null,
      };
    });

    return res.json(payments);
  } catch (error: any) {
    console.error('Error getting payments:', error);
    return res.status(500).json({ message: error.message });
  }
});

// GET /payments/stripe-connect/:clinicId/status
router.get('/stripe-connect/:clinicId/status', verifyAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const clinicId = req.params.clinicId;
    if (user?.clinicId !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const clinicRef = db.collection(CLINICS).doc(clinicId);
    const clinicDoc = await clinicRef.get();
    if (!clinicDoc.exists) {
      return res.status(404).json({ message: 'Clinic not found' });
    }

    const clinicData = clinicDoc.data() as Record<string, unknown> | undefined;
    const state = mapStripeStateFromClinic(clinicData);

    // If account exists and Stripe is configured, refresh account capabilities from Stripe.
    if (state.accountId && process.env.STRIPE_SECRET_KEY) {
      try {
        const account = await fetchStripeAccount(state.accountId);
        state.chargesEnabled = account.charges_enabled;
        state.payoutsEnabled = account.payouts_enabled;
        state.detailsSubmitted = account.details_submitted;
        state.country = account.country;
        state.defaultCurrency = account.default_currency;
        state.onboardingComplete = Boolean(
          account.charges_enabled && account.payouts_enabled && account.details_submitted
        );
        state.updatedAt = new Date().toISOString();

        await clinicRef.set(
          {
            paymentSettings: {
              ...(clinicData?.paymentSettings as Record<string, unknown> | undefined),
              stripeConnect: removeUndefined({
                accountId: state.accountId,
                onboardingComplete: state.onboardingComplete,
                chargesEnabled: state.chargesEnabled,
                payoutsEnabled: state.payoutsEnabled,
                detailsSubmitted: state.detailsSubmitted,
                country: state.country,
                defaultCurrency: state.defaultCurrency,
                updatedAt: new Date(),
              }),
            },
          },
          { merge: true }
        );
      } catch (error) {
        console.warn(`Failed to refresh Stripe account status for ${clinicId}:`, error);
      }
    }

    return res.json({
      stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY && getStripeClientId()),
      state,
    });
  } catch (error: any) {
    console.error('Error getting Stripe Connect status:', error);
    return res.status(500).json({ message: error.message || 'Failed to get Stripe status' });
  }
});

// POST /payments/stripe-connect/:clinicId/start
router.post('/stripe-connect/:clinicId/start', verifyAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const clinicId = req.params.clinicId;
    const { frontendBaseUrl } = req.body as { frontendBaseUrl?: string };
    if (user?.clinicId !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    requireStripeSecret();
    if (!getStripeClientId()) {
      return res.status(500).json({
        message: 'Stripe Connect is not configured (missing STRIPE_CONNECT_CLIENT_ID)',
      });
    }

    const clinicRef = db.collection(CLINICS).doc(clinicId);
    const clinicDoc = await clinicRef.get();
    if (!clinicDoc.exists) {
      return res.status(404).json({ message: 'Clinic not found' });
    }

    const clinicData = clinicDoc.data() as Record<string, unknown> | undefined;
    const state = mapStripeStateFromClinic(clinicData);

    let accountId = state.accountId;
    if (!accountId) {
      const account = await createStripeExpressAccount(clinicId);
      accountId = account.id;
    }

    const accountLink = await createStripeAccountLink(accountId, frontendBaseUrl);

    await clinicRef.set(
      {
        paymentSettings: {
          ...(clinicData?.paymentSettings as Record<string, unknown> | undefined),
          stripeConnect: removeUndefined({
            ...(state || {}),
            accountId,
            updatedAt: new Date(),
          }),
        },
      },
      { merge: true }
    );

    return res.json({
      accountId,
      onboardingUrl: accountLink.url,
    });
  } catch (error: any) {
    console.error('Error starting Stripe Connect onboarding:', error);
    return res
      .status(500)
      .json({ message: error.message || 'Failed to start Stripe Connect onboarding' });
  }
});

// POST /payments/stripe-connect/:clinicId/refresh
router.post(
  '/stripe-connect/:clinicId/refresh',
  verifyAuth,
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const clinicId = req.params.clinicId;
      const { frontendBaseUrl } = req.body as { frontendBaseUrl?: string };
      if (user?.clinicId !== clinicId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      requireStripeSecret();
      const clinicDoc = await db.collection(CLINICS).doc(clinicId).get();
      if (!clinicDoc.exists) {
        return res.status(404).json({ message: 'Clinic not found' });
      }

      const clinicData = clinicDoc.data() as Record<string, unknown> | undefined;
      const state = mapStripeStateFromClinic(clinicData);
      if (!state.accountId) {
        return res.status(400).json({ message: 'Stripe account not found for this clinic' });
      }

      const accountLink = await createStripeAccountLink(state.accountId, frontendBaseUrl);
      return res.json({
        accountId: state.accountId,
        onboardingUrl: accountLink.url,
      });
    } catch (error: any) {
      console.error('Error refreshing Stripe Connect onboarding link:', error);
      return res.status(500).json({
        message: error.message || 'Failed to refresh Stripe Connect onboarding',
      });
    }
  }
);

export default router;
