import crypto from 'crypto';

// Haversine distance in meters
function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const INITIAL_SPOTS = [
  {
    _id: 'spot-101',
    host: 'usr-demo-host',
    title: 'Covered Portico & Gated Driveway',
    address: 'Near Main Road, Vallam, Thanjavur, Tamil Nadu',
    location: { type: 'Point', coordinates: [79.0849, 10.7181] },
    hourlyRate: 35,
    vehicleTypes: ['BIKE', 'HATCHBACK', 'SEDAN', 'SUV'],
    amenities: ['CCTV Monitored', 'Covered Roof', 'Gated Security'],
    contactName: 'Ananya Verma (Host)',
    contactPhone: '+91 98424 12345',
    instructions: 'Ring bell at Gate #2 or call host upon arrival. Security guard will verify OTP.',
    photos: [
      'https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=900&q=80',
    ],
    photoUrl: 'https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=900&q=80',
    isActive: true,
    createdAt: new Date(),
  },
  {
    _id: 'spot-102',
    host: 'usr-demo-host',
    title: 'Prime Safe Garage (CCTV Secured - Bay 3)',
    address: '45 North Usman Road, T. Nagar, Chennai',
    location: { type: 'Point', coordinates: [80.2341, 13.0418] },
    hourlyRate: 50,
    vehicleTypes: ['SEDAN', 'SUV', 'HATCHBACK'],
    amenities: ['CCTV Monitored', 'Gated Security', 'EV Charging'],
    contactName: 'Ananya Verma (Host)',
    contactPhone: '+91 98424 12345',
    instructions: 'Basement ramp on the left. Present 4-digit OTP at entry boom barrier.',
    photos: [
      'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=900&q=80',
    ],
    photoUrl: 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=900&q=80',
    isActive: true,
    createdAt: new Date(),
  },
  {
    _id: 'spot-103',
    host: 'usr-demo-host',
    title: 'Central Junction Parking Bay',
    address: 'Opposite Railway Station Access Rd, Thanjavur, TN',
    location: { type: 'Point', coordinates: [79.0809, 10.7198] },
    hourlyRate: 30,
    vehicleTypes: ['BIKE', 'HATCHBACK', 'SEDAN'],
    amenities: ['Gated Security', 'Well Lit at Night'],
    contactName: 'Ananya Verma (Host)',
    contactPhone: '+91 98424 12345',
    instructions: 'Parking attendant is available 24/7. Show booking OTP for entry.',
    photos: [
      'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=900&q=80',
    ],
    photoUrl: 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=900&q=80',
    isActive: true,
    createdAt: new Date(),
  },
  {
    _id: 'spot-104',
    host: 'usr-demo-host',
    title: 'Koramangala Tech Corridor Open Bay',
    address: '80 Feet Road, 4th Block, Koramangala, Bengaluru',
    location: { type: 'Point', coordinates: [77.6245, 12.9352] },
    hourlyRate: 60,
    vehicleTypes: ['BIKE', 'HATCHBACK', 'SEDAN', 'SUV'],
    amenities: ['CCTV Monitored', 'Gated Security', 'EV Charging'],
    contactName: 'Ananya Verma (Host)',
    contactPhone: '+91 98424 12345',
    instructions: 'Direct access from 80ft road. Guard will check digital pass.',
    photos: [
      'https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?auto=format&fit=crop&w=900&q=80',
    ],
    photoUrl: 'https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?auto=format&fit=crop&w=900&q=80',
    isActive: true,
    createdAt: new Date(),
  },
];

import { fileDb } from './fileDb.js';

// Load spots and bookings from persistent disk database
const savedSpots = fileDb.getAllSpots();
const savedBookings = fileDb.getAllBookings();

export const memorySpots = new Map(savedSpots.map((s) => [String(s._id || s.id), { ...s }]));
export const memoryBookings = new Map(savedBookings.map((b) => [String(b._id || b.id), { ...b }]));

export const store = {
  // SPOTS
  getNearbySpots(lat, lng, radius = 50000, vehicleType) {
    const list = [];
    for (const spot of memorySpots.values()) {
      if (!spot.isActive) continue;
      if (vehicleType && vehicleType !== 'ALL' && Array.isArray(spot.vehicleTypes) && !spot.vehicleTypes.includes(vehicleType)) {
        continue;
      }
      const spotLng = spot.location?.coordinates?.[0] || 79.0833;
      const spotLat = spot.location?.coordinates?.[1] || 10.7167;
      const dist = haversineDistanceMeters(lat, lng, spotLat, spotLng);
      list.push({ ...spot, distance: Math.round(dist) });
    }

    // Sort nearest first; if none within radius, return all active spots with their distances
    list.sort((a, b) => a.distance - b.distance);
    const filtered = list.filter((s) => s.distance <= radius);
    return filtered.length > 0 ? filtered : list.slice(0, 15);
  },

  getSpotById(id) {
    if (!id) return null;
    return memorySpots.get(String(id)) || null;
  },

  getSpotsByHost(hostId) {
    if (!hostId) return [];
    return Array.from(memorySpots.values())
      .filter((s) => {
        const spotHost = String(s.host?._id || s.host?.id || s.host || '');
        return spotHost === String(hostId);
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  createSpot(spotData) {
    const id = 'spot-' + Date.now() + '-' + Math.floor(100 + Math.random() * 900);
    const newSpot = {
      _id: id,
      ...spotData,
      isActive: true,
      createdAt: new Date(),
    };
    memorySpots.set(id, newSpot);
    fileDb.saveSpot(newSpot);
    return newSpot;
  },

  updateSpot(id, updates) {
    const spot = memorySpots.get(String(id));
    if (!spot) return null;
    const updated = { ...spot, ...updates };
    memorySpots.set(String(id), updated);
    fileDb.saveSpot(updated);
    return updated;
  },

  deleteSpot(id) {
    fileDb.deleteSpot(String(id));
    return memorySpots.delete(String(id));
  },

  // BOOKINGS
  createBooking(bookingData) {
    const id = 'bk-' + Date.now() + '-' + Math.floor(1000 + Math.random() * 9000);
    const spotObj = typeof bookingData.spot === 'object' ? bookingData.spot : memorySpots.get(String(bookingData.spot));
    const hostId = String(spotObj?.host?._id || spotObj?.host?.id || spotObj?.host || bookingData.host || '');
    const newBooking = {
      _id: id,
      ...bookingData,
      host: hostId,
      spot: spotObj || { _id: bookingData.spot, title: 'Reserved Parking Space' },
      status: 'CONFIRMED',
      otp: bookingData.otp || String(Math.floor(1000 + Math.random() * 9000)),
      createdAt: new Date(),
      checkedInAt: null,
      checkedOutAt: null,
    };
    memoryBookings.set(id, newBooking);
    fileDb.saveBooking(newBooking);
    return newBooking;
  },

  getBookingById(id) {
    if (!id) return null;
    const b = memoryBookings.get(String(id));
    if (!b) return null;
    // Ensure spot is populated
    if (b.spot && typeof b.spot === 'string') {
      b.spot = memorySpots.get(b.spot) || { _id: b.spot, title: 'Reserved Parking Bay' };
    }
    return b;
  },

  getBookingsForDriver(driverId) {
    const list = [];
    for (const b of memoryBookings.values()) {
      if (String(b.driver) === String(driverId)) {
        const spot = typeof b.spot === 'object' ? b.spot : memorySpots.get(String(b.spot)) || { _id: b.spot, title: 'Parking Bay' };
        list.push({ ...b, spot });
      }
    }
    return list.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
  },

  getBookingsForHost(hostId) {
    if (!hostId) return [];
    const targetHostId = String(hostId);
    const mySpotIds = new Set();
    for (const s of memorySpots.values()) {
      const sHost = String(s.host?._id || s.host?.id || s.host || '');
      if (sHost === targetHostId) {
        mySpotIds.add(String(s._id || s.id));
      }
    }

    const list = [];
    for (const b of memoryBookings.values()) {
      const bSpotId = String(b.spot?._id || b.spot?.id || b.spot || '');
      const spotObj = typeof b.spot === 'object' ? b.spot : memorySpots.get(bSpotId);
      const spotHost = String(b.host || spotObj?.host?._id || spotObj?.host?.id || spotObj?.host || '');

      const isHostMatch = spotHost === targetHostId;
      const isSpotMatch = mySpotIds.has(bSpotId);

      if (isHostMatch || isSpotMatch) {
        const spot = spotObj || { _id: bSpotId, title: 'Parking Bay' };
        list.push({ ...b, spot });
      }
    }
    return list.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
  },

  checkin(id, otp) {
    const b = memoryBookings.get(String(id));
    if (!b) return { error: 'Booking not found' };
    if (b.status !== 'CONFIRMED') return { error: 'Booking is not awaiting check-in' };
    if (String(otp).trim() !== String(b.otp).trim()) return { error: 'Wrong OTP' };
    b.status = 'ACTIVE';
    b.checkedInAt = new Date();
    fileDb.saveBooking(b);
    return { booking: b };
  },

  checkout(id) {
    const b = memoryBookings.get(String(id));
    if (!b) return { error: 'Booking not found' };
    if (b.status !== 'ACTIVE') return { error: 'Booking is not active' };
    b.status = 'COMPLETED';
    b.checkedOutAt = new Date();
    fileDb.saveBooking(b);
    return { booking: b };
  },
};
