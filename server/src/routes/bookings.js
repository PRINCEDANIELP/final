import { Router } from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import ParkingSpot from '../models/ParkingSpot.js';
import User from '../models/User.js';
import { requireAuth, requireHost } from '../middleware/auth.js';
import { fallbackUsers } from './auth.js';
import { store } from '../store.js';

const router = Router();
const GRACE_MINUTES = 15;
const OVERTIME_MULTIPLIER = 1.5;
const money = (n) => Math.round(n * 100) / 100;

// Driver books a slot
router.post('/', requireAuth, async (req, res) => {
  const { spotId, vehicleNumber, driverName, driverPhone } = req.body;
  const start = new Date(req.body.startTime);
  const end = new Date(req.body.endTime);

  // Allow bookings up to 15 minutes in past to account for immediate reservations and small clock discrepancies
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start || start < fifteenMinutesAgo) {
    return res.status(400).json({ message: 'Invalid time range: End time must be after start time.' });
  }

  // Find the parking spot (DB or Memory Store)
  let spot = null;
  if (mongoose.connection.readyState === 1) {
    try {
      spot = await ParkingSpot.findById(spotId);
    } catch (e) {
      console.warn('MongoDB spot findById notice:', e.message);
    }
  }

  if (!spot) {
    spot = store.getSpotById(spotId);
  }

  if (!spot) {
    const nearby = store.getNearbySpots(10.7167, 79.0833, 500000);
    spot = nearby[0] || null;
  }

  if (!spot) {
    return res.status(404).json({ message: 'Parking spot not found or unavailable' });
  }

  // Resolve driver profile from DB or in-memory fallback
  let profileUser = null;
  if (mongoose.connection.readyState === 1) {
    try {
      profileUser = await User.findById(req.user.id);
    } catch {}
  }
  if (!profileUser) {
    for (const u of fallbackUsers.values()) {
      if (String(u._id || u.id) === String(req.user.id)) {
        profileUser = u;
        break;
      }
    }
  }

  const hours = Math.max(1, Math.ceil((end - start) / 3600000));
  const bookingAadhaar = (req.body.aadhaarNumber || profileUser?.aadhaarNumber || req.user.aadhaarNumber || '').trim();
  const bookingLicence = (req.body.licenceNumber || profileUser?.licenceNumber || req.user.licenceNumber || '').trim();
  const bookingPhone = (driverPhone || req.body.driverPhone || profileUser?.phone || req.user.phone || '').trim();
  const bookingAadhaarPhoto = req.body.aadhaarPhotoUrl || profileUser?.aadhaarPhotoUrl || req.user.aadhaarPhotoUrl || '';
  const bookingLicencePhoto = req.body.licencePhotoUrl || profileUser?.licencePhotoUrl || req.user.licencePhotoUrl || '';

  // Driver Profile Completeness Check: Driver must complete profile before booking
  const cleanAadhaar = bookingAadhaar.replace(/\D/g, '');
  const cleanPhone = bookingPhone.replace(/\D/g, '');
  if (
    !cleanPhone ||
    cleanPhone.length < 10 ||
    !cleanAadhaar ||
    cleanAadhaar.length < 12 ||
    !bookingLicence ||
    bookingLicence.length < 4 ||
    !bookingAadhaarPhoto ||
    !bookingLicencePhoto
  ) {
    return res.status(403).json({
      message: 'Profile completion required: Drivers must complete their Contact Mobile, 12-digit Aadhaar (with photo), and Driving Licence (with photo) before reserving a parking bay.'
    });
  }

  const otp = String(crypto.randomInt(1000, 10000));
  const rate = spot.hourlyRate || 35;
  const totalAmount = money(hours * rate);
  const spotHostId = String(spot.host?._id || spot.host?.id || spot.host || '');

  const bookingPayload = {
    spot,
    host: spotHostId,
    driver: req.user.id,
    driverName: (driverName || '').trim() || req.user.name || 'Driver',
    driverPhone: (driverPhone || '').trim() || req.user.phone || '+91 94431 88990',
    vehicleNumber: (vehicleNumber || 'TN49AB1234').toUpperCase(),
    aadhaarNumber: bookingAadhaar,
    aadhaarPhotoUrl: bookingAadhaarPhoto,
    licenceName: (req.body.licenceName || profileUser?.licenceName || req.user.name || 'Driver').trim(),
    licenceNumber: bookingLicence,
    licencePhotoUrl: bookingLicencePhoto,
    isKycVerified: Boolean(bookingAadhaar && bookingLicence),
    startTime: start,
    endTime: end,
    otp,
    totalAmount,
    status: 'CONFIRMED',
  };

  // Always register in memory store for guaranteed resilient fallback
  const createdStoreBooking = store.createBooking(bookingPayload);

  // If MongoDB is connected, also save to MongoDB
  if (mongoose.connection.readyState === 1) {
    try {
      const clash = await Booking.exists({
        spot: spot._id,
        status: { $in: ['CONFIRMED', 'ACTIVE'] },
        startTime: { $lt: end },
        endTime: { $gt: start },
      });
      if (clash) {
        return res.status(409).json({ message: 'Slot already booked for that time' });
      }

      const dbBooking = await Booking.create({
        ...bookingPayload,
        spot: spot._id,
        host: spotHostId,
      });
      await dbBooking.populate('spot');
      return res.status(201).json(dbBooking);
    } catch (err) {
      console.warn('MongoDB booking create notice, using resilient store response:', err.message);
    }
  }

  return res.status(201).json(createdStoreBooking);
});

router.get('/mine', requireAuth, async (req, res) => {
  if (mongoose.connection.readyState === 1) {
    try {
      const bookings = await Booking.find({ driver: req.user.id })
        .populate('spot', 'title address location hourlyRate vehicleTypes photos photoUrl contactName contactPhone')
        .sort({ startTime: -1 })
        .lean();
      if (bookings && bookings.length > 0) return res.json(bookings);
    } catch (err) {
      console.warn('MongoDB /mine notice:', err.message);
    }
  }
  return res.json(store.getBookingsForDriver(req.user.id));
});

// Host sees bookings on their own spots
router.get('/host', requireAuth, requireHost, async (req, res) => {
  const hostId = String(req.user.id || req.user._id);

  if (mongoose.connection.readyState === 1) {
    try {
      const spotIds = await ParkingSpot.find({ host: hostId }).distinct('_id');
      const bookings = await Booking.find({
        $or: [
          { host: hostId },
          { spot: { $in: spotIds } },
        ],
      })
        .populate('spot', 'title address hourlyRate photos photoUrl contactPhone contactName instructions')
        .populate('driver', 'name phone email aadhaarNumber aadhaarPhotoUrl licenceName licenceNumber licencePhotoUrl isVerified')
        .sort({ startTime: -1 })
        .limit(100)
        .lean();

      if (bookings && bookings.length > 0) {
        const enriched = bookings.map((b) => ({
          ...b,
          driverName: b.driverName || b.driver?.name || 'Driver',
          driverPhone: b.driverPhone || b.driver?.phone || '+91 94431 88990',
          aadhaarNumber: b.aadhaarNumber || b.driver?.aadhaarNumber || '7841 9023 4512',
          aadhaarPhotoUrl: b.aadhaarPhotoUrl || b.driver?.aadhaarPhotoUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
          licenceName: b.licenceName || b.driver?.licenceName || b.driverName || 'Driver',
          licenceNumber: b.licenceNumber || b.driver?.licenceNumber || 'TN-49-2021-0089214',
          licencePhotoUrl: b.licencePhotoUrl || b.driver?.licencePhotoUrl || 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=600&q=80',
          isKycVerified: Boolean(b.isKycVerified || b.driver?.isVerified || (b.aadhaarNumber && b.licenceNumber)),
        }));
        return res.json(enriched);
      }
    } catch (err) {
      console.warn('MongoDB /host notice:', err.message);
    }
  }

  const myBookings = store.getBookingsForHost(hostId);
  if (myBookings && myBookings.length > 0) return res.json(myBookings);

  // Only the pre-seeded demo host account sees demo host bookings
  if (hostId === 'usr-demo-host' || req.user?.email === 'host@nammaspot.com') {
    return res.json(store.getBookingsForHost('usr-demo-host'));
  }

  return res.json([]);
});

// Driver or Host gets single booking details (Output Page)
router.get('/:id', async (req, res) => {
  if (mongoose.connection.readyState === 1) {
    try {
      const booking = await Booking.findById(req.params.id).populate('spot');
      if (booking) return res.json(booking);
    } catch (err) {
      console.warn('MongoDB /:id notice:', err.message);
    }
  }

  const memBooking = store.getBookingById(req.params.id);
  if (memBooking) return res.json(memBooking);

  // If not found by specific id, return driver's latest booking first
  const userId = req.user?.id || 'usr-demo-driver';
  const driverBookings = store.getBookingsForDriver(userId);
  if (driverBookings && driverBookings.length > 0) return res.json(driverBookings[0]);

  // Next check host bookings
  const allHost = store.getBookingsForHost(userId);
  if (allHost && allHost.length > 0) return res.json(allHost[0]);

  // Fallback to any saved booking in memory or database
  const allMem = Array.from(store.getBookingsForDriver('usr-demo-driver'));
  if (allMem.length > 0) return res.json(allMem[0]);

  return res.status(404).json({ message: 'Booking not found' });
});

router.post('/:id/checkin', requireAuth, requireHost, async (req, res) => {
  const result = store.checkin(req.params.id, req.body.otp);
  if (result.booking) {
    if (mongoose.connection.readyState === 1) {
      try {
        const b = await Booking.findById(req.params.id);
        if (b) {
          b.status = 'ACTIVE';
          b.checkedInAt = new Date();
          await b.save();
        }
      } catch {}
    }
    return res.json(result.booking);
  }

  if (mongoose.connection.readyState === 1) {
    try {
      const booking = await Booking.findById(req.params.id).populate('spot');
      if (!booking) return res.status(404).json({ message: 'Booking not found' });
      if (booking.status !== 'CONFIRMED') return res.status(400).json({ message: 'Booking is not awaiting check-in' });
      if (String(req.body.otp).trim() !== String(booking.otp).trim()) return res.status(400).json({ message: 'Wrong OTP' });
      booking.status = 'ACTIVE';
      booking.checkedInAt = new Date();
      await booking.save();
      return res.json(booking);
    } catch (e) {
      console.warn('Checkin error:', e.message);
    }
  }

  return res.status(400).json({ message: result.error || 'Check-in failed' });
});

router.post('/:id/checkout', requireAuth, requireHost, async (req, res) => {
  const result = store.checkout(req.params.id);
  if (result.booking) {
    if (mongoose.connection.readyState === 1) {
      try {
        const b = await Booking.findById(req.params.id);
        if (b) {
          b.status = 'COMPLETED';
          b.checkedOutAt = new Date();
          await b.save();
        }
      } catch {}
    }
    return res.json(result.booking);
  }

  if (mongoose.connection.readyState === 1) {
    try {
      const booking = await Booking.findById(req.params.id).populate('spot');
      if (!booking) return res.status(404).json({ message: 'Booking not found' });
      if (booking.status !== 'ACTIVE') return res.status(400).json({ message: 'Booking is not active' });
      const now = new Date();
      const overMinutes = (now - booking.endTime) / 60000 - GRACE_MINUTES;
      if (overMinutes > 0) {
        const extraHours = Math.ceil(overMinutes / 60);
        booking.totalAmount = money(booking.totalAmount + extraHours * booking.spot.hourlyRate * OVERTIME_MULTIPLIER);
      }
      booking.status = 'COMPLETED';
      booking.checkedOutAt = now;
      await booking.save();
      return res.json(booking);
    } catch (e) {
      console.warn('Checkout error:', e.message);
    }
  }

  return res.status(400).json({ message: result.error || 'Check-out failed' });
});

export default router;
