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

// ============================================
// STRIPE CHECKOUT SESSION (Destination Charges)
// ============================================

const APPLICATION_FEE_PERCENT = 5; // Gendei's 5% platform commission

function requireServiceSecret(req: Request): boolean {
  const secret = req.headers['x-gendei-service-secret'] as string | undefined;
  const expected = process.env.GENDEI_SERVICE_SECRET;
  return Boolean(expected && secret === expected);
}

// POST /payments/stripe-checkout/:clinicId/create-session
// Called by the Python agent (service-to-service auth)
router.post(
  '/stripe-checkout/:clinicId/create-session',
  async (req: Request, res: Response) => {
    try {
      if (!requireServiceSecret(req)) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const clinicId = req.params.clinicId;
      const { orderId, appointmentId, amountCents, totalCents, patientName, patientPhone, description } =
        req.body as {
          orderId: string;
          appointmentId: string;
          amountCents: number;
          totalCents?: number;
          patientName: string;
          patientPhone: string;
          description: string;
        };

      if (!orderId || !amountCents || amountCents < 100) {
        return res.status(400).json({ message: 'Missing or invalid required fields' });
      }

      requireStripeSecret();

      // Get clinic's Stripe Connect state
      const clinicDoc = await db.collection(CLINICS).doc(clinicId).get();
      if (!clinicDoc.exists) {
        return res.status(404).json({ message: 'Clinic not found' });
      }

      const clinicData = clinicDoc.data() as Record<string, unknown> | undefined;
      const stripeConnect = mapStripeStateFromClinic(clinicData);
      const connectReady = Boolean(
        stripeConnect.accountId &&
          stripeConnect.chargesEnabled &&
          stripeConnect.payoutsEnabled &&
          stripeConnect.onboardingComplete
      );

      // Commission is 5% of the TOTAL consultation price, not the deposit amount.
      // E.g. consultation R$1000, deposit 10% (R$100) → fee = 5% of R$1000 = R$50.
      // Cap at the deposit amount so fee never exceeds what the patient pays.
      const feeBase = totalCents && totalCents > 0 ? totalCents : amountCents;
      const applicationFeeCents = Math.min(
        Math.round(feeBase * APPLICATION_FEE_PERCENT / 100),
        amountCents
      );
      const chargeType = connectReady ? 'destination' : 'platform_hold';

      // Build Checkout Session params
      const body = new URLSearchParams();
      body.append('mode', 'payment');
      body.append('line_items[0][price_data][currency]', 'brl');
      body.append('line_items[0][price_data][unit_amount]', String(amountCents));
      body.append('line_items[0][price_data][product_data][name]', description || 'Sinal de consulta');
      body.append('line_items[0][quantity]', '1');
      body.append('payment_method_types[0]', 'card');
      body.append('success_url', `${getFrontendBaseUrl()}/checkout/success?session_id={CHECKOUT_SESSION_ID}`);
      body.append('cancel_url', `${getFrontendBaseUrl()}/checkout/cancel`);
      body.append('expires_at', String(Math.floor(Date.now() / 1000) + 1800)); // 30 min
      body.append('metadata[clinicId]', clinicId);
      body.append('metadata[orderId]', orderId);
      body.append('metadata[appointmentId]', appointmentId || '');
      body.append('metadata[patientPhone]', patientPhone || '');
      body.append('metadata[patientName]', patientName || '');
      body.append('metadata[chargeType]', chargeType);
      body.append('metadata[totalCents]', String(totalCents || amountCents));

      if (connectReady && stripeConnect.accountId) {
        // Destination charge: funds go to clinic minus application fee
        body.append('payment_intent_data[application_fee_amount]', String(applicationFeeCents));
        body.append('payment_intent_data[transfer_data][destination]', stripeConnect.accountId);
      }

      body.append('payment_intent_data[metadata][clinicId]', clinicId);
      body.append('payment_intent_data[metadata][orderId]', orderId);
      body.append('payment_intent_data[metadata][chargeType]', chargeType);

      const session = await stripeRequest<{
        id: string;
        url: string;
        payment_intent: string;
      }>('/checkout/sessions', { method: 'POST', body });

      return res.json({
        sessionId: session.id,
        checkoutUrl: session.url,
        paymentIntentId: session.payment_intent,
        chargeType,
      });
    } catch (error: any) {
      console.error('Error creating Stripe checkout session:', error);
      return res.status(500).json({ message: error.message || 'Failed to create checkout session' });
    }
  }
);

// Stripe webhook handler - exported for mounting with raw body parser in index.ts
export async function handleStripeWebhook(req: Request, res: Response) {
  try {
    const sig = req.headers['stripe-signature'] as string | undefined;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    // Verify webhook signature if secret is configured
    if (webhookSecret && sig) {
      const crypto = await import('crypto');
      const rawBody = (req as any).body;
      const payload = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');

      // Parse the Stripe-Signature header
      const parts = sig.split(',').reduce<Record<string, string>>((acc, part) => {
        const [key, value] = part.split('=');
        acc[key] = value;
        return acc;
      }, {});

      const timestamp = parts['t'];
      const expectedSig = parts['v1'];

      if (!timestamp || !expectedSig) {
        return res.status(400).json({ message: 'Invalid signature header' });
      }

      // Compute expected signature
      const signedPayload = `${timestamp}.${payload}`;
      const computed = crypto
        .createHmac('sha256', webhookSecret)
        .update(signedPayload)
        .digest('hex');

      if (computed !== expectedSig) {
        return res.status(400).json({ message: 'Invalid signature' });
      }

      // Verify timestamp is within tolerance (5 minutes)
      const tolerance = 300;
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - parseInt(timestamp, 10)) > tolerance) {
        return res.status(400).json({ message: 'Webhook timestamp too old' });
      }
    }

    const rawBody = (req as any).body;
    const event = JSON.parse(typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8'));

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const metadata = session.metadata || {};
        const { clinicId, orderId, appointmentId, patientPhone, patientName, chargeType } = metadata;

        if (!clinicId || !orderId) {
          console.warn('Stripe webhook missing clinicId or orderId in metadata');
          break;
        }

        // Retrieve PaymentIntent to get charge ID (needed for later transfers)
        let chargeId: string | undefined;
        if (session.payment_intent) {
          try {
            const pi = await stripeRequest<{ latest_charge: string }>(
              `/payment_intents/${session.payment_intent}`
            );
            chargeId = pi.latest_charge;
          } catch (err) {
            console.warn('Failed to retrieve charge ID from PaymentIntent:', err);
          }
        }

        const amountTotal = session.amount_total || 0;
        // Fee is 5% of total consultation price, capped at the deposit amount
        const totalConsultation = parseInt(metadata.totalCents || '0', 10) || amountTotal;
        const applicationFeeCents = Math.min(
          Math.round(totalConsultation * APPLICATION_FEE_PERCENT / 100),
          amountTotal
        );

        // Update order in Firestore
        const orderRef = db.collection(CLINICS).doc(clinicId).collection('orders').doc(orderId);
        await orderRef.update({
          paymentStatus: 'completed',
          status: 'paid',
          stripeSessionId: session.id,
          stripePaymentIntentId: session.payment_intent || null,
          stripeChargeId: chargeId || null,
          applicationFeeAmount: applicationFeeCents,
          heldForConnect: chargeType === 'platform_hold',
          paidAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        // Update appointment
        if (appointmentId) {
          const aptRef = db
            .collection(CLINICS)
            .doc(clinicId)
            .collection('appointments')
            .doc(appointmentId);
          const aptDoc = await aptRef.get();
          if (aptDoc.exists) {
            await aptRef.update({
              signalPaid: true,
              signalPaidAt: new Date().toISOString(),
              status: 'confirmed',
            });
          }
        }

        // If platform hold, create held_payments record for later transfer
        if (chargeType === 'platform_hold') {
          await db
            .collection(CLINICS)
            .doc(clinicId)
            .collection('held_payments')
            .doc(session.payment_intent || orderId)
            .set({
              paymentIntentId: session.payment_intent || null,
              chargeId: chargeId || null,
              orderId,
              appointmentId: appointmentId || null,
              amountCents: amountTotal,
              applicationFeeCents,
              netAmountCents: amountTotal - applicationFeeCents,
              patientPhone: patientPhone || null,
              patientName: patientName || null,
              status: 'held',
              createdAt: new Date().toISOString(),
            });
        }

        // Notify agent service to send WhatsApp confirmation
        const agentUrl = process.env.AGENT_SERVICE_URL;
        if (agentUrl && patientPhone) {
          try {
            await fetch(`${agentUrl}/stripe-payment-callback`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Gendei-Service-Secret': process.env.GENDEI_SERVICE_SECRET || '',
              },
              body: JSON.stringify({
                clinicId,
                orderId,
                appointmentId,
                patientPhone,
                patientName,
                paymentStatus: 'completed',
                amountCents: amountTotal,
              }),
            });
          } catch (err) {
            console.error('Failed to notify agent service of Stripe payment:', err);
          }
        }

        console.log(
          `Stripe payment completed: clinic=${clinicId} order=${orderId} type=${chargeType} amount=${amountTotal}`
        );
        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object;
        const metadata = session.metadata || {};
        const { clinicId, orderId } = metadata;

        if (clinicId && orderId) {
          await db.collection(CLINICS).doc(clinicId).collection('orders').doc(orderId).update({
            paymentStatus: 'expired',
            status: 'expired',
            updatedAt: new Date().toISOString(),
          });
          console.log(`Stripe checkout expired: clinic=${clinicId} order=${orderId}`);
        }
        break;
      }

      default:
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }

    return res.json({ received: true });
  } catch (error: any) {
    console.error('Error handling Stripe webhook:', error);
    return res.status(500).json({ message: error.message });
  }
}

// GET /payments/stripe-connect/:clinicId/held
// List held payments waiting for Connect completion
router.get('/stripe-connect/:clinicId/held', verifyAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const clinicId = req.params.clinicId;
    if (user?.clinicId !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const snapshot = await db
      .collection(CLINICS)
      .doc(clinicId)
      .collection('held_payments')
      .orderBy('createdAt', 'desc')
      .get();

    const heldPayments = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.json({ data: heldPayments });
  } catch (error: any) {
    console.error('Error getting held payments:', error);
    return res.status(500).json({ message: error.message });
  }
});

// POST /payments/stripe-connect/:clinicId/transfer-held
// Transfer held payments to clinic's connected account
router.post(
  '/stripe-connect/:clinicId/transfer-held',
  verifyAuth,
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const clinicId = req.params.clinicId;
      if (user?.clinicId !== clinicId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      requireStripeSecret();

      // Verify clinic's Connect is ready
      const clinicDoc = await db.collection(CLINICS).doc(clinicId).get();
      if (!clinicDoc.exists) {
        return res.status(404).json({ message: 'Clinic not found' });
      }

      const clinicData = clinicDoc.data() as Record<string, unknown> | undefined;
      const stripeConnect = mapStripeStateFromClinic(clinicData);

      if (!stripeConnect.accountId || !stripeConnect.chargesEnabled || !stripeConnect.payoutsEnabled) {
        return res.status(400).json({
          message: 'Stripe Connect is not ready for transfers. Please complete onboarding first.',
        });
      }

      // Get all held payments
      const heldSnap = await db
        .collection(CLINICS)
        .doc(clinicId)
        .collection('held_payments')
        .where('status', '==', 'held')
        .get();

      if (heldSnap.empty) {
        return res.json({ transferred: 0, results: [] });
      }

      const results: Array<{
        orderId: string;
        transferId?: string;
        status: string;
        error?: string;
      }> = [];

      for (const doc of heldSnap.docs) {
        const held = doc.data();
        try {
          const transferBody = new URLSearchParams({
            amount: String(held.netAmountCents),
            currency: 'brl',
            destination: stripeConnect.accountId!,
          });

          // Link to original charge if available
          if (held.chargeId) {
            transferBody.append('source_transaction', held.chargeId);
          }

          transferBody.append('metadata[clinicId]', clinicId);
          transferBody.append('metadata[orderId]', held.orderId);

          const transfer = await stripeRequest<{ id: string }>('/transfers', {
            method: 'POST',
            body: transferBody,
          });

          await doc.ref.update({
            status: 'transferred',
            stripeTransferId: transfer.id,
            transferredAt: new Date().toISOString(),
          });

          // Update the original order too
          if (held.orderId) {
            await db
              .collection(CLINICS)
              .doc(clinicId)
              .collection('orders')
              .doc(held.orderId)
              .update({ heldTransferredAt: new Date().toISOString() });
          }

          results.push({ orderId: held.orderId, transferId: transfer.id, status: 'transferred' });
        } catch (err: any) {
          console.error(`Failed to transfer held payment ${doc.id}:`, err);
          results.push({ orderId: held.orderId, error: err.message, status: 'failed' });
        }
      }

      return res.json({
        transferred: results.filter((r) => r.status === 'transferred').length,
        failed: results.filter((r) => r.status === 'failed').length,
        results,
      });
    } catch (error: any) {
      console.error('Error transferring held payments:', error);
      return res.status(500).json({ message: error.message });
    }
  }
);

export default router;
