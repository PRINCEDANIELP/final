import { Router } from 'express';
import mongoose from 'mongoose';
import ParkingSpot from '../models/ParkingSpot.js';
import { requireAuth, requireHost } from '../middleware/auth.js';
import { store } from '../store.js';

const router = Router();

// Spots within radius (meters) of a point, nearest first
router.get('/nearby', async (req, res) => {
  const lng = parseFloat(req.query.lng);
  const lat = parseFloat(req.query.lat);
  const radius = Math.min(parseInt(req.query.radius, 10) || 5000, 50000);

  if (Number.isNaN(lng) || Number.isNaN(lat)) {
    return res.status(400).json({ message: 'lat and lng are required' });
  }

  // 1. If MongoDB is connected, attempt geoNear aggregation
  if (mongoose.connection.readyState === 1) {
    try {
      const match = { isActive: true };
      if (req.query.vehicleType && req.query.vehicleType !== 'ALL') {
        match.vehicleTypes = req.query.vehicleType;
      }

      let spots = await ParkingSpot.aggregate([
        {
          $geoNear: {
            near: { type: 'Point', coordinates: [lng, lat] },
            distanceField: 'distance',
            maxDistance: radius,
            spherical: true,
            query: match,
          },
        },
        { $limit: 50 },
      ]);

      if (spots && spots.length > 0) {
        return res.json(spots);
      }
    } catch (err) {
      console.warn('MongoDB /spots/nearby notice, falling back to memory store:', err.message);
    }
  }

  // 2. Resilient memory store fallback
  const fallbackSpots = store.getNearbySpots(lat, lng, radius, req.query.vehicleType);
  return res.json(fallbackSpots);
});

router.get('/mine', requireAuth, requireHost, async (req, res) => {
  if (mongoose.connection.readyState === 1) {
    try {
      const dbSpots = await ParkingSpot.find({ host: req.user.id }).sort({ createdAt: -1 }).lean();
      if (dbSpots && dbSpots.length > 0) return res.json(dbSpots);
    } catch (err) {
      console.warn('MongoDB /spots/mine notice:', err.message);
    }
  }
  const mySpots = store.getSpotsByHost(req.user.id);
  if (mySpots && mySpots.length > 0) return res.json(mySpots);
  if (req.user?.id === 'usr-demo-host' || req.user?.email === 'host@nammaspot.com') {
    return res.json(store.getSpotsByHost('usr-demo-host'));
  }
  return res.json([]);
});

router.post('/', requireAuth, requireHost, async (req, res) => {
  const { title, address, lat, lng, vehicleTypes, hourlyRate, photoUrl, photos, amenities, contactPhone, contactName, instructions } = req.body;
  const spotPhotos = Array.isArray(photos) && photos.length ? photos : (photoUrl ? [photoUrl] : []);

  const spotData = {
    host: req.user.id,
    title,
    address,
    location: { type: 'Point', coordinates: [Number(lng), Number(lat)] },
    vehicleTypes: Array.isArray(vehicleTypes) ? vehicleTypes : ['SEDAN'],
    hourlyRate: Number(hourlyRate) || 40,
    photoUrl: spotPhotos[0] || photoUrl || 'https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=900&q=80',
    photos: spotPhotos,
    amenities: amenities || [],
    contactPhone: contactPhone || '',
    contactName: contactName || '',
    instructions: instructions || '',
  };

  // Always save in memory store for immediate fallback reliability
  const createdStoreSpot = store.createSpot(spotData);

  if (mongoose.connection.readyState === 1) {
    try {
      const spot = await ParkingSpot.create(spotData);
      return res.status(201).json(spot);
    } catch (err) {
      console.warn('MongoDB spot create notice:', err.message);
    }
  }

  return res.status(201).json(createdStoreSpot);
});

router.patch('/:id/toggle', requireAuth, requireHost, async (req, res) => {
  const current = store.getSpotById(req.params.id);
  const newActive = current ? !current.isActive : true;
  store.updateSpot(req.params.id, { isActive: newActive });

  if (mongoose.connection.readyState === 1) {
    try {
      const spot = await ParkingSpot.findOne({ _id: req.params.id, host: req.user.id });
      if (spot) {
        spot.isActive = !spot.isActive;
        await spot.save();
        return res.json(spot);
      }
    } catch (err) {
      console.warn('MongoDB toggle notice:', err.message);
    }
  }

  return res.json(store.getSpotById(req.params.id) || { _id: req.params.id, isActive: newActive });
});

// Update spot details / photos (CRUD Update)
router.patch('/:id', requireAuth, requireHost, async (req, res) => {
  const updates = { ...req.body };
  if (req.body.photos !== undefined) {
    updates.photos = req.body.photos;
    updates.photoUrl = req.body.photos[0] || updates.photoUrl;
  }
  if (req.body.hourlyRate) updates.hourlyRate = Number(req.body.hourlyRate);

  const updatedStoreSpot = store.updateSpot(req.params.id, updates);

  if (mongoose.connection.readyState === 1) {
    try {
      const spot = await ParkingSpot.findOne({ _id: req.params.id, host: req.user.id });
      if (spot) {
        Object.assign(spot, updates);
        await spot.save();
        return res.json(spot);
      }
    } catch (err) {
      console.warn('MongoDB patch spot notice:', err.message);
    }
  }

  return res.json(updatedStoreSpot || { _id: req.params.id, ...updates });
});

// Delete a spot (CRUD Delete)
router.delete('/:id', requireAuth, requireHost, async (req, res) => {
  store.deleteSpot(req.params.id);

  if (mongoose.connection.readyState === 1) {
    try {
      await ParkingSpot.findOneAndDelete({ _id: req.params.id, host: req.user.id });
    } catch (err) {
      console.warn('MongoDB delete spot notice:', err.message);
    }
  }

  return res.json({ message: 'Parking spot deleted successfully', id: req.params.id });
});

export default router;
