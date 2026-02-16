// Gendei Reminders Route
// HTTP endpoint for triggering reminders (used by Cloud Scheduler)

import { Router, Request, Response } from 'express';
import { sendScheduledReminders, sendSingleReminder } from '../services/reminders';
import { cleanupExpiredPaymentHolds } from '../services/payment-holds';

const router = Router();

function verifyServiceSecret(req: Request, res: Response): boolean {
  const expected = process.env.GENDEI_SERVICE_SECRET;
  const provided = req.header('X-Gendei-Service-Secret') || req.header('x-gendei-service-secret');

  if (!expected) {
    res.status(500).json({
      success: false,
      error: 'Service secret not configured',
    });
    return false;
  }

  if (!provided || provided !== expected) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
    });
    return false;
  }

  return true;
}

/**
 * POST /reminders/trigger
 * Triggers the scheduled reminders check
 * Called by Cloud Scheduler every 15 minutes
 */
router.post('/trigger', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!verifyServiceSecret(req, res)) return;
    console.log('Reminder trigger received from:', req.body?.source || 'unknown');

    const result = await sendScheduledReminders();

    res.json({
      success: true,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error triggering reminders:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to trigger reminders'
    });
  }
});

/**
 * POST /reminders/send/:appointmentId
 * Send a specific reminder for testing
 */
router.post('/send/:appointmentId', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!verifyServiceSecret(req, res)) return;
    const { appointmentId } = req.params;
    const { type = '24h' } = req.body;

    if (!['24h', '2h'].includes(type)) {
      res.status(400).json({
        error: 'Invalid reminder type. Use "24h" or "2h"'
      });
      return;
    }

    const success = await sendSingleReminder(appointmentId, type);

    if (success) {
      res.json({
        success: true,
        message: `${type} reminder sent for appointment ${appointmentId}`
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Failed to send reminder. Check logs for details.'
      });
    }
  } catch (error: any) {
    console.error('Error sending single reminder:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send reminder'
    });
  }
});

/**
 * POST /reminders/cleanup-payment-holds
 * Manual trigger to release unpaid pending holds
 */
router.post('/cleanup-payment-holds', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!verifyServiceSecret(req, res)) return;
    console.log('Manual payment-hold cleanup trigger received from:', req.body?.source || 'unknown');
    const result = await cleanupExpiredPaymentHolds();
    res.json({
      success: true,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error cleaning payment holds:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to cleanup payment holds',
    });
  }
});

export default router;
