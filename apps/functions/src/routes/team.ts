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

export default router;
