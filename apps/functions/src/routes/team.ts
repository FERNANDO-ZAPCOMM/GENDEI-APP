// Gendei Team Routes
// Simplified team endpoints for clinic-based permissions

import { Router, Request, Response } from 'express';
import { verifyAuth } from '../middleware/auth';

const router = Router();

// GET /team/my-role - Get current user's role
// For Gendei, we return 'owner' if the user owns a clinic, 'admin' if they're an admin
router.get('/my-role', verifyAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user;

    if (!user) {
      res.status(401).json({ message: 'Not authenticated' });
      return;
    }

    // In Gendei, roles are based on clinic ownership/admin status
    let role = null;

    if (user.isOwner) {
      role = 'owner';
    } else if (user.isAdmin) {
      role = 'admin';
    }

    res.json({ role });
  } catch (error) {
    console.error('Error fetching user role:', error);
    res.status(500).json({ message: 'Failed to fetch user role' });
  }
});

// GET /team/members - Get team members (placeholder for now)
router.get('/members', verifyAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user;

    if (!user?.clinicId) {
      res.json([]);
      return;
    }

    // For now, return empty array - Gendei doesn't have team members yet
    res.json([]);
  } catch (error) {
    console.error('Error fetching team members:', error);
    res.status(500).json({ message: 'Failed to fetch team members' });
  }
});

// GET /team/invitations - Get pending invitations (placeholder for now)
router.get('/invitations', verifyAuth, async (req: Request, res: Response) => {
  try {
    // Return empty array for now
    res.json([]);
  } catch (error) {
    console.error('Error fetching invitations:', error);
    res.status(500).json({ message: 'Failed to fetch invitations' });
  }
});

export default router;
