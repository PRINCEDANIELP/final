import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';

// Disable query buffering when disconnected to prevent 10s request hangs
mongoose.set('bufferCommands', false);
import authRoutes from './routes/auth.js';
import spotRoutes from './routes/spots.js';
import bookingRoutes from './routes/bookings.js';

import { fileDb } from './fileDb.js';

const app = express();

// Permissive CORS to support localhost, Vercel deployments (*.vercel.app), and custom CLIENT_URL
const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5000',
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      try {
        const hostname = new URL(origin).hostname;
        if (
          allowedOrigins.includes(origin) ||
          hostname.endsWith('.vercel.app') ||
          hostname === 'localhost' ||
          hostname === '127.0.0.1'
        ) {
          return callback(null, true);
        }
      } catch (e) {
        // Fallback for non-standard origins
      }
      return callback(null, true);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true, timestamp: new Date().toISOString() }));
app.get('/api/db-status', (req, res) => {
  res.json({
    mongoConnected: mongoose.connection.readyState === 1,
    mongoState: mongoose.connection.readyState,
    fileDbActive: true,
    totalUsers: fileDb.getAllUsers().length,
    totalSpots: fileDb.getAllSpots().length,
    totalBookings: fileDb.getAllBookings().length,
  });
});
app.use('/api/auth', authRoutes);
app.use('/api/spots', spotRoutes);
app.use('/api/bookings', bookingRoutes);

import User from './models/User.js';
import ParkingSpot from './models/ParkingSpot.js';
import Booking from './models/Booking.js';

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`API running on http://localhost:${port}`));

mongoose
  .connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/parkshare')
  .then(async () => {
    console.log('✓ MongoDB Atlas connected successfully');
    try {
      const localUsers = fileDb.getAllUsers();
      for (const u of localUsers) {
        if (!u.email) continue;
        const exists = await User.findOne({ email: u.email.toLowerCase().trim() });
        if (!exists) {
          await User.create({
            name: u.name,
            email: u.email.toLowerCase().trim(),
            passwordHash: u.passwordHash,
            role: u.role || 'driver',
            phone: u.phone || '',
            aadhaarNumber: u.aadhaarNumber || '',
            aadhaarPhotoUrl: u.aadhaarPhotoUrl || '',
            licenceName: u.licenceName || '',
            licenceNumber: u.licenceNumber || '',
            licencePhotoUrl: u.licencePhotoUrl || '',
            isVerified: Boolean(u.isVerified),
            city: u.city || '',
            address: u.address || '',
          });
        }
      }
      const localSpots = fileDb.getAllSpots();
      for (const s of localSpots) {
        const exists = await ParkingSpot.findOne({ title: s.title, address: s.address });
        if (!exists) {
          const { _id, ...spotData } = s;
          await ParkingSpot.create({
            ...spotData,
            location: s.location || { type: 'Point', coordinates: [80.2707, 13.0827] },
          });
        }
      }
      const localBookings = fileDb.getAllBookings();
      for (const b of localBookings) {
        if (!b.otp || !b.vehicleNumber) continue;
        const exists = await Booking.findOne({ otp: b.otp, vehicleNumber: b.vehicleNumber });
        if (!exists) {
          const { _id, ...bookingData } = b;
          await Booking.create(bookingData);
        }
      }
      console.log('✓ All disk database records synchronized with MongoDB Atlas successfully');
    } catch (syncErr) {
      console.warn('Atlas sync notice:', syncErr.message);
    }
  })
  .catch((err) => {
    console.error('MongoDB connection notice:', err.message);
    console.error('Note: If using MongoDB Atlas, check your Database Access username & password in server/.env');
  });
