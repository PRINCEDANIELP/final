import 'dotenv/config';
import dns from 'node:dns';

// Configure resilient DNS resolution for MongoDB Atlas SRV lookups on Windows
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (dnsErr) {
  console.warn('DNS server config notice:', dnsErr.message);
}

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

let isMongoConnecting = false;
async function connectDB() {
  if (mongoose.connection.readyState === 1 || isMongoConnecting) return;
  isMongoConnecting = true;
  try {
    const uri =
      process.env.MONGO_URI ||
      'mongodb+srv://prince:prince081104@cluster0.p7pt0ci.mongodb.net/parkshare?retryWrites=true&w=majority';
    await mongoose.connect(uri);
    console.log('✓ MongoDB Atlas connected successfully');
  } catch (err) {
    console.error('MongoDB connection notice:', err.message);
  } finally {
    isMongoConnecting = false;
  }
}

// Auto-connect middleware for serverless (Vercel)
app.use(async (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    await connectDB().catch(() => {});
  }
  next();
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

export default app;

if (!process.env.VERCEL) {
  const port = process.env.PORT || 5000;
  app.listen(port, () => console.log(`API running on http://localhost:${port}`));
}

connectDB()
  .then(async () => {
    try {
      const localUsers = fileDb.getAllUsers();
      for (const u of localUsers) {
        if (!u.email) continue;
        const cleanEmail = u.email.toLowerCase().trim();
        const exists = await User.findOne({ email: cleanEmail });
        if (!exists) {
          await User.create({
            name: u.name || 'User',
            email: cleanEmail,
            passwordHash: u.passwordHash || 'fallback-hash',
            role: u.role || 'driver',
            phone: u.phone || '',
            aadhaarNumber: u.aadhaarNumber || '',
            aadhaarPhotoUrl: u.aadhaarPhotoUrl || '',
            licenceName: u.licenceName || '',
            licenceNumber: u.licenceNumber || '',
            licencePhotoUrl: u.licencePhotoUrl || '',
            isVerified: Boolean(u.isVerified || (u.aadhaarNumber && u.licenceNumber)),
            city: u.city || '',
            address: u.address || '',
            vehicleNumber: u.vehicleNumber || '',
            firebaseUid: u.firebaseUid || '',
          });
        } else {
          // If user exists in MongoDB parkshare db, backfill any empty profile fields
          const profileUpdates = {};
          if (!exists.phone && u.phone) profileUpdates.phone = u.phone;
          if (!exists.aadhaarNumber && u.aadhaarNumber) profileUpdates.aadhaarNumber = u.aadhaarNumber;
          if (!exists.aadhaarPhotoUrl && u.aadhaarPhotoUrl) profileUpdates.aadhaarPhotoUrl = u.aadhaarPhotoUrl;
          if (!exists.licenceName && u.licenceName) profileUpdates.licenceName = u.licenceName;
          if (!exists.licenceNumber && u.licenceNumber) profileUpdates.licenceNumber = u.licenceNumber;
          if (!exists.licencePhotoUrl && u.licencePhotoUrl) profileUpdates.licencePhotoUrl = u.licencePhotoUrl;
          if (!exists.city && u.city) profileUpdates.city = u.city;
          if (!exists.address && u.address) profileUpdates.address = u.address;
          if (!exists.vehicleNumber && u.vehicleNumber) profileUpdates.vehicleNumber = u.vehicleNumber;
          if (!exists.isVerified && (u.isVerified || (u.aadhaarNumber && u.licenceNumber))) {
            profileUpdates.isVerified = true;
          }
          if (Object.keys(profileUpdates).length > 0) {
            await User.updateOne({ email: cleanEmail }, { $set: profileUpdates });
          }
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
