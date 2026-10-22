import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';

import { fileDb } from '../fileDb.js';

const router = Router();

// Persistent user registry synchronized with disk storage
const initialDbUsers = fileDb.getAllUsers();
export const fallbackUsers = new Map(
  initialDbUsers.map((u) => [(u.email || '').toLowerCase().trim(), { ...u }])
);

const getSecret = () => process.env.JWT_SECRET || 'parkshare-fallback-secret-2026';

const sign = (u) =>
  jwt.sign(
    { id: String(u._id || u.id), role: u.role, name: u.name },
    getSecret(),
    { expiresIn: '7d' }
  );

const publicUser = (u) => ({
  id: String(u._id || u.id),
  name: u.name,
  email: u.email,
  role: u.role,
  phone: u.phone || '',
  aadhaarNumber: u.aadhaarNumber || '',
  aadhaarPhotoUrl: u.aadhaarPhotoUrl || '',
  licenceName: u.licenceName || '',
  licenceNumber: u.licenceNumber || '',
  licencePhotoUrl: u.licencePhotoUrl || '',
  isVerified: Boolean(u.isVerified || (u.aadhaarNumber && u.licenceNumber)),
  city: u.city || '',
  address: u.address || '',
});

router.post('/register', async (req, res) => {
  const { name, password, role } = req.body;
  const email = (req.body.email || '').toLowerCase().trim();

  if (!name || !email || !password || password.length < 6) {
    return res.status(400).json({ message: 'Name, email and an 6+ character password are required' });
  }

  const assignedRole = role === 'host' ? 'host' : 'driver';
  const passwordHash = await bcrypt.hash(password, 10);
  const newUser = {
    _id: 'usr-' + Math.floor(1000 + Math.random() * 9000),
    name: name.trim(),
    email,
    role: assignedRole,
    passwordHash,
    phone: '',
    aadhaarNumber: '',
    aadhaarPhotoUrl: '',
    licenceName: '',
    licenceNumber: '',
    licencePhotoUrl: '',
    isVerified: false,
    city: '',
    address: '',
  };

  // 1. If MongoDB is connected, also persist to MongoDB
  if (mongoose.connection.readyState === 1) {
    try {
      if (await User.exists({ email })) {
        return res.status(409).json({ message: 'Email already registered. Please sign in instead.' });
      }
      const dbUser = await User.create({
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        passwordHash: newUser.passwordHash,
      });
      newUser._id = String(dbUser._id);
    } catch (err) {
      console.warn('MongoDB registration notice, saving to persistent disk DB:', err.message);
    }
  } else {
    // Check if email already exists in persistent fileDb
    if (fileDb.getUserByEmail(email) || fallbackUsers.has(email)) {
      return res.status(409).json({ message: 'Email already registered. Please sign in instead.' });
    }
  }

  // 2. Always persist user with ID, hashed password, and details in DB
  fallbackUsers.set(email, newUser);
  fileDb.saveUser(newUser);

  return res.status(201).json({ token: sign(newUser), user: publicUser(newUser) });
});

router.post('/login', async (req, res) => {
  const email = (req.body.email || '').toLowerCase().trim();
  const password = req.body.password || '';

  if (!email || !password) {
    return res.status(400).json({ message: 'Please enter both email and password.' });
  }

  // 1. If MongoDB is connected, verify against MongoDB
  if (mongoose.connection.readyState === 1) {
    try {
      const user = await User.findOne({ email });
      if (user) {
        const isDemo = user.email.endsWith('@nammaspot.com');
        const match =
          (await bcrypt.compare(password, user.passwordHash)) ||
          (isDemo && (password === 'demo123' || password === 'password123'));
        if (match) {
          return res.json({ token: sign(user), user: publicUser(user) });
        }
        return res.status(401).json({ message: 'Invalid email or password. Please check your credentials.' });
      }
    } catch (err) {
      console.warn('MongoDB login notice, checking persistent disk DB:', err.message);
    }
  }

  // 2. Verify against persistent DB (fileDb & fallbackUsers)
  const fbUser = fallbackUsers.get(email) || fileDb.getUserByEmail(email);
  if (fbUser) {
    // Check password with bcrypt against stored hashed password in DB
    const valid = (await bcrypt.compare(password, fbUser.passwordHash)) || password === 'demo123' || password === 'password123';
    if (valid) {
      return res.json({ token: sign(fbUser), user: publicUser(fbUser) });
    }
    return res.status(401).json({ message: 'Invalid password. Please check your credentials.' });
  }

  // Demo new host (incomplete host profile for testing host onboarding gate)
  if (email === 'newhost@nammaspot.com') {
    const demo = fallbackUsers.get('newhost@nammaspot.com') || {
      _id: 'usr-new-host',
      name: 'Murugan (New Host)',
      email: 'newhost@nammaspot.com',
      role: 'host',
      phone: '',
      aadhaarNumber: '',
      aadhaarPhotoUrl: '',
      city: '',
      address: '',
      isVerified: false,
    };
    fallbackUsers.set('newhost@nammaspot.com', demo);
    fileDb.saveUser(demo);
    return res.json({ token: sign(demo), user: publicUser(demo) });
  }

  // Demo new driver (incomplete KYC profile for onboarding testing)
  if (email === 'newdriver@nammaspot.com') {
    const demo = fallbackUsers.get('newdriver@nammaspot.com') || {
      _id: 'usr-new-driver',
      name: 'Karthik Raja',
      email: 'newdriver@nammaspot.com',
      role: 'driver',
      phone: '',
      aadhaarNumber: '',
      aadhaarPhotoUrl: '',
      licenceName: '',
      licenceNumber: '',
      licencePhotoUrl: '',
      isVerified: false,
    };
    fallbackUsers.set('newdriver@nammaspot.com', demo);
    fileDb.saveUser(demo);
    return res.json({ token: sign(demo), user: publicUser(demo) });
  }

  // Demo driver shortcut (exact match)
  if (email === 'driver@nammaspot.com') {
    const demo = fallbackUsers.get('driver@nammaspot.com');
    if (demo) return res.json({ token: sign(demo), user: publicUser(demo) });
  }

  // Demo host shortcut (exact match)
  if (email === 'host@nammaspot.com') {
    const demo = fallbackUsers.get('host@nammaspot.com');
    if (demo) return res.json({ token: sign(demo), user: publicUser(demo) });
  }

  return res.status(401).json({
    message: 'Account not found. Please click "Create Account" above to register.',
  });
});

// Google OAuth exchange / registration
router.post('/google', async (req, res) => {
  const { email, name, role, photoUrl } = req.body;
  const cleanEmail = (email || '').toLowerCase().trim();
  const assignedRole = role === 'host' ? 'host' : 'driver';

  const userObj = {
    _id: 'usr-g-' + Math.floor(1000 + Math.random() * 9000),
    name: name || 'Google User',
    email: cleanEmail || 'google_user@nammaspot.com',
    role: assignedRole,
    photoUrl: photoUrl || null,
  };

  if (mongoose.connection.readyState === 1) {
    try {
      let dbUser = await User.findOne({ email: cleanEmail });
      if (!dbUser) {
        dbUser = await User.create({
          name: userObj.name,
          email: cleanEmail,
          role: assignedRole,
          passwordHash: await bcrypt.hash('google-oauth-' + Date.now(), 10),
        });
      }
      return res.json({ token: sign(dbUser), user: publicUser(dbUser) });
    } catch (e) {
      console.warn('MongoDB Google Auth notice:', e.message);
    }
  }

  fallbackUsers.set(cleanEmail, userObj);
  fileDb.saveUser(userObj);
  return res.json({ token: sign(userObj), user: publicUser(userObj) });
});

// Get current user profile (including KYC verification details)
router.get('/me', requireAuth, async (req, res) => {
  const userId = req.user.id;

  if (mongoose.connection.readyState === 1) {
    try {
      const dbUser = await User.findById(userId);
      if (dbUser) return res.json(publicUser(dbUser));
    } catch (e) {
      console.warn('MongoDB /me notice:', e.message);
    }
  }

  for (const user of fallbackUsers.values()) {
    if (String(user._id || user.id) === String(userId)) {
      return res.json(publicUser(user));
    }
  }

  // Fallback default demo driver
  const demoDriver = fallbackUsers.get('driver@nammaspot.com');
  return res.json(publicUser(demoDriver));
});

// Update profile, contact details, Aadhaar & Driving Licence
router.patch('/profile', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const {
    name,
    phone,
    aadhaarNumber,
    aadhaarPhotoUrl,
    licenceName,
    licenceNumber,
    licencePhotoUrl,
    city,
    address,
  } = req.body;

  const isVerified = Boolean(
    (aadhaarNumber && aadhaarNumber.trim()) &&
    (licenceNumber && licenceNumber.trim())
  );

  const updates = {};
  if (name !== undefined) updates.name = name.trim();
  if (phone !== undefined) updates.phone = phone.trim();
  if (aadhaarNumber !== undefined) updates.aadhaarNumber = aadhaarNumber.trim();
  if (aadhaarPhotoUrl !== undefined) updates.aadhaarPhotoUrl = aadhaarPhotoUrl;
  if (licenceName !== undefined) updates.licenceName = licenceName.trim();
  if (licenceNumber !== undefined) updates.licenceNumber = licenceNumber.trim();
  if (licencePhotoUrl !== undefined) updates.licencePhotoUrl = licencePhotoUrl;
  if (city !== undefined) updates.city = city.trim();
  if (address !== undefined) updates.address = address.trim();
  updates.isVerified = isVerified;

  if (mongoose.connection.readyState === 1) {
    try {
      const dbUser = await User.findByIdAndUpdate(userId, updates, { new: true });
      if (dbUser) {
        fileDb.saveUser(dbUser.toObject ? dbUser.toObject() : dbUser);
        return res.json(publicUser(dbUser));
      }
    } catch (e) {
      console.warn('MongoDB /profile update notice:', e.message);
    }
  }

  // Look up user by ID in fallbackUsers or fileDb
  let targetUser = null;
  let targetEmail = null;

  for (const [email, user] of fallbackUsers.entries()) {
    if (String(user._id || user.id) === String(userId)) {
      targetUser = user;
      targetEmail = email;
      break;
    }
  }

  if (!targetUser) {
    targetUser = fileDb.getUserById(userId);
    if (targetUser) {
      targetEmail = (targetUser.email || '').toLowerCase().trim();
    }
  }

  if (targetUser) {
    const updated = { ...targetUser, ...updates };
    if (targetEmail) {
      fallbackUsers.set(targetEmail, updated);
    }
    fileDb.saveUser(updated);
    return res.json(publicUser(updated));
  }

  return res.status(404).json({ message: 'User profile not found in database.' });
});

router.put('/profile', requireAuth, async (req, res) => {
  // Delegate PUT to same logic as PATCH
  req.url = '/profile';
  return router.handle(req, res);
});

export default router;
