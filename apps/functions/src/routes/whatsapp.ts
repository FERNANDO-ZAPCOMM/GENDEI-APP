import { Router, Request, Response } from 'express';
import { verifyAuth } from '../middleware/auth';
import * as metaService from '../services/meta';

const router = Router();

// POST /whatsapp/request-verification - Request SMS/Voice verification code
router.post(
  '/request-verification',
  verifyAuth,
  async (req: Request, res: Response) => {
    try {
      const { phoneNumberId, method } = req.body;
      const clinicId = req.user!.clinicId;

      if (!clinicId) {
        res.status(401).json({ error: 'Clinic not found' });
        return;
      }

      if (!phoneNumberId) {
        res.status(400).json({ error: 'phoneNumberId is required' });
        return;
      }

      if (!method || !['SMS', 'VOICE'].includes(method)) {
        res.status(400).json({ error: 'method must be SMS or VOICE' });
        return;
      }

      await metaService.requestVerificationCode(phoneNumberId, method, clinicId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error requesting verification code:', error);
      res.status(400).json({
        error: (error as Error).message || 'Failed to request verification code',
      });
    }
  }
);

// POST /whatsapp/register-number - Register phone number with verification code
router.post(
  '/register-number',
  verifyAuth,
  async (req: Request, res: Response) => {
    try {
      const { phoneNumberId, code } = req.body;
      const clinicId = req.user!.clinicId;

      if (!clinicId) {
        res.status(401).json({ error: 'Clinic not found' });
        return;
      }

      if (!phoneNumberId || !code) {
        res.status(400).json({ error: 'phoneNumberId and code are required' });
        return;
      }

      await metaService.registerPhoneNumber(phoneNumberId, code, clinicId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error registering phone number:', error);
      res.status(400).json({
        error: (error as Error).message || 'Invalid verification code',
      });
    }
  }
);

// POST /whatsapp/test-message - Send WhatsApp test message
router.post(
  '/test-message',
  verifyAuth,
  async (req: Request, res: Response) => {
    try {
      const { phoneNumberId, to } = req.body;
      const clinicId = req.user!.clinicId;

      if (!clinicId) {
        res.status(401).json({ error: 'Clinic not found' });
        return;
      }

      if (!phoneNumberId || !to) {
        res.status(400).json({ error: 'phoneNumberId and to are required' });
        return;
      }

      const result = await metaService.sendTestMessage(
        phoneNumberId,
        to,
        clinicId
      );

      res.json(result);
    } catch (error) {
      console.error('Error sending test message:', error);
      res.status(400).json({
        error: (error as Error).message || 'Failed to send message',
      });
    }
  }
);

// GET /whatsapp/business-profile - Get WhatsApp Business Profile
router.get(
  '/business-profile',
  verifyAuth,
  async (req: Request, res: Response) => {
    try {
      const { phoneNumberId } = req.query;
      const clinicId = req.user!.clinicId;

      if (!clinicId) {
        res.status(401).json({ error: 'Clinic not found' });
        return;
      }

      if (!phoneNumberId || typeof phoneNumberId !== 'string') {
        res.status(400).json({ error: 'phoneNumberId is required' });
        return;
      }

      const profile = await metaService.getBusinessProfile(phoneNumberId, clinicId);
      res.json(profile);
    } catch (error) {
      console.error('Error fetching business profile:', error);
      res.status(400).json({
        error: (error as Error).message || 'Failed to fetch business profile',
      });
    }
  }
);

// GET /whatsapp/display-name - Get display name and status
router.get(
  '/display-name',
  verifyAuth,
  async (req: Request, res: Response) => {
    try {
      const { phoneNumberId } = req.query;
      const clinicId = req.user!.clinicId;

      if (!clinicId) {
        res.status(401).json({ error: 'Clinic not found' });
        return;
      }

      if (!phoneNumberId || typeof phoneNumberId !== 'string') {
        res.status(400).json({ error: 'phoneNumberId is required' });
        return;
      }

      const status = await metaService.getDisplayNameStatus(phoneNumberId, clinicId);
      res.json(status);
    } catch (error) {
      console.error('Error fetching display name status:', error);
      res.status(400).json({
        error: (error as Error).message || 'Failed to fetch display name status',
      });
    }
  }
);

// POST /whatsapp/display-name - Update display name via API
router.post(
  '/display-name',
  verifyAuth,
  async (req: Request, res: Response) => {
    try {
      const { phoneNumberId, newDisplayName } = req.body;
      const clinicId = req.user!.clinicId;

      if (!clinicId) {
        res.status(401).json({ error: 'Clinic not found' });
        return;
      }

      if (!phoneNumberId) {
        res.status(400).json({ error: 'phoneNumberId is required' });
        return;
      }

      if (!newDisplayName || typeof newDisplayName !== 'string') {
        res.status(400).json({ error: 'newDisplayName is required' });
        return;
      }

      await metaService.updateDisplayName(phoneNumberId, clinicId, newDisplayName);
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating display name:', error);
      res.status(400).json({
        error: (error as Error).message || 'Failed to update display name',
      });
    }
  }
);

// POST /whatsapp/business-profile - Update WhatsApp Business Profile
router.post(
  '/business-profile',
  verifyAuth,
  async (req: Request, res: Response) => {
    try {
      const { phoneNumberId, profile } = req.body;
      const clinicId = req.user!.clinicId;

      if (!clinicId) {
        res.status(401).json({ error: 'Clinic not found' });
        return;
      }

      if (!phoneNumberId) {
        res.status(400).json({ error: 'phoneNumberId is required' });
        return;
      }

      await metaService.updateBusinessProfile(phoneNumberId, clinicId, profile || {});
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating business profile:', error);
      res.status(400).json({
        error: (error as Error).message || 'Failed to update business profile',
      });
    }
  }
);

// POST /whatsapp/business-profile/picture - Upload and set business profile picture
router.post(
  '/business-profile/picture',
  verifyAuth,
  async (req: Request, res: Response) => {
    try {
      const { phoneNumberId, imageBase64, mimeType } = req.body;
      const clinicId = req.user!.clinicId;

      if (!clinicId) {
        res.status(401).json({ error: 'Clinic not found' });
        return;
      }

      if (!phoneNumberId) {
        res.status(400).json({ error: 'phoneNumberId is required' });
        return;
      }

      if (!imageBase64) {
        res.status(400).json({ error: 'imageBase64 is required' });
        return;
      }

      // Convert base64 to Buffer
      const imageBuffer = Buffer.from(imageBase64, 'base64');
      const imageMimeType = mimeType || 'image/jpeg';

      // Upload the image and get a handle
      const pictureHandle = await metaService.uploadBusinessProfilePicture(
        phoneNumberId,
        clinicId,
        imageBuffer,
        imageMimeType
      );

      // Set the profile picture using the handle
      await metaService.setBusinessProfilePicture(phoneNumberId, clinicId, pictureHandle);

      res.json({ success: true });
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      res.status(400).json({
        error: (error as Error).message || 'Failed to upload profile picture',
      });
    }
  }
);

// GET /whatsapp/qr-codes - List all QR codes for the phone number
router.get(
  '/qr-codes',
  verifyAuth,
  async (req: Request, res: Response) => {
    try {
      const phoneNumberId = req.query.phoneNumberId as string;
      const clinicId = req.user!.clinicId;

      if (!clinicId) {
        res.status(401).json({ error: 'Clinic not found' });
        return;
      }

      if (!phoneNumberId) {
        res.status(400).json({ error: 'phoneNumberId is required' });
        return;
      }

      const qrCodes = await metaService.getQRCodes(phoneNumberId, clinicId);
      res.json({ data: qrCodes });
    } catch (error) {
      console.error('Error fetching QR codes:', error);
      res.status(400).json({
        error: (error as Error).message || 'Failed to fetch QR codes',
      });
    }
  }
);

// POST /whatsapp/qr-codes - Create a new QR code
router.post(
  '/qr-codes',
  verifyAuth,
  async (req: Request, res: Response) => {
    try {
      const { phoneNumberId, prefilledMessage } = req.body;
      const clinicId = req.user!.clinicId;

      if (!clinicId) {
        res.status(401).json({ error: 'Clinic not found' });
        return;
      }

      if (!phoneNumberId) {
        res.status(400).json({ error: 'phoneNumberId is required' });
        return;
      }

      if (!prefilledMessage) {
        res.status(400).json({ error: 'prefilledMessage is required' });
        return;
      }

      const qrCode = await metaService.createQRCode(phoneNumberId, clinicId, prefilledMessage);
      res.json({ data: qrCode });
    } catch (error) {
      console.error('Error creating QR code:', error);
      res.status(400).json({
        error: (error as Error).message || 'Failed to create QR code',
      });
    }
  }
);

// DELETE /whatsapp/qr-codes/:codeId - Delete a QR code
router.delete(
  '/qr-codes/:codeId',
  verifyAuth,
  async (req: Request, res: Response) => {
    try {
      const { codeId } = req.params;
      const phoneNumberId = req.query.phoneNumberId as string;
      const clinicId = req.user!.clinicId;

      if (!clinicId) {
        res.status(401).json({ error: 'Clinic not found' });
        return;
      }

      if (!phoneNumberId) {
        res.status(400).json({ error: 'phoneNumberId is required' });
        return;
      }

      await metaService.deleteQRCode(phoneNumberId, clinicId, codeId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting QR code:', error);
      res.status(400).json({
        error: (error as Error).message || 'Failed to delete QR code',
      });
    }
  }
);

export default router;
