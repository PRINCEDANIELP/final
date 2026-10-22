import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SPOTS_FILE = path.join(DATA_DIR, 'spots.json');
const BOOKINGS_FILE = path.join(DATA_DIR, 'bookings.json');

const INITIAL_USERS = [
  {
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
    city: 'Thanjavur',
    address: '',
    passwordHash: '$2a$10$wTqK47r3rYcZJk5oGv6hfe7zLp7MvAeqwN4Z8J6X.7V5B3M9N2LKi', // demo123
  },
  {
    _id: 'usr-demo-driver',
    name: 'Rahul Sharma',
    email: 'driver@nammaspot.com',
    role: 'driver',
    phone: '+91 94431 88990',
    aadhaarNumber: '7841 9023 4512',
    aadhaarPhotoUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
    licenceName: 'Rahul Sharma',
    licenceNumber: 'TN-49-2021-0089214',
    licencePhotoUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=600&q=80',
    isVerified: true,
    city: 'Thanjavur',
    address: 'Near New Bus Stand, Vallam, Thanjavur',
    passwordHash: '$2a$10$wTqK47r3rYcZJk5oGv6hfe7zLp7MvAeqwN4Z8J6X.7V5B3M9N2LKi', // demo123
  },
  {
    _id: 'usr-demo-host',
    name: 'Ananya Verma',
    email: 'host@nammaspot.com',
    role: 'host',
    phone: '+91 98424 12345',
    aadhaarNumber: '4512 8901 2345',
    aadhaarPhotoUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
    licenceName: 'Ananya Verma',
    licenceNumber: 'TN-01-2019-0044123',
    licencePhotoUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=600&q=80',
    isVerified: true,
    city: 'Thanjavur',
    address: 'Near Main Road, Vallam, Thanjavur',
    passwordHash: '$2a$10$wTqK47r3rYcZJk5oGv6hfe7zLp7MvAeqwN4Z8J6X.7V5B3M9N2LKi', // demo123
  },
  {
    _id: 'usr-new-host',
    name: 'Murugan (New Host)',
    email: 'newhost@nammaspot.com',
    role: 'host',
    phone: '',
    aadhaarNumber: '',
    aadhaarPhotoUrl: '',
    licenceName: '',
    licenceNumber: '',
    licencePhotoUrl: '',
    isVerified: false,
    city: 'Thanjavur',
    address: '',
    passwordHash: '$2a$10$wTqK47r3rYcZJk5oGv6hfe7zLp7MvAeqwN4Z8J6X.7V5B3M9N2LKi', // demo123
  },
];

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
    createdAt: new Date().toISOString(),
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
    createdAt: new Date().toISOString(),
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
    createdAt: new Date().toISOString(),
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
    createdAt: new Date().toISOString(),
  },
];

function readJsonFile(filePath, fallbackData) {
  try {
    if (!fs.existsSync(filePath)) {
      writeJsonFile(filePath, fallbackData);
      return fallbackData;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err.message);
    return fallbackData;
  }
}

function writeJsonFile(filePath, data) {
  try {
    const tmpPath = `${filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    console.error(`Error writing to ${filePath}:`, err.message);
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.error(`Fatal write to ${filePath}:`, e.message);
    }
  }
}

// In-memory caches synchronized with disk files
let usersList = readJsonFile(USERS_FILE, INITIAL_USERS);
let spotsList = readJsonFile(SPOTS_FILE, INITIAL_SPOTS);
let bookingsList = readJsonFile(BOOKINGS_FILE, []);

export const fileDb = {
  // USERS (Drivers & Hosts)
  getAllUsers() {
    return [...usersList];
  },

  getUserByEmail(email) {
    if (!email) return null;
    const clean = email.toLowerCase().trim();
    return usersList.find((u) => u.email && u.email.toLowerCase().trim() === clean) || null;
  },

  getUserById(id) {
    if (!id) return null;
    return usersList.find((u) => String(u._id || u.id) === String(id)) || null;
  },

  saveUser(userData) {
    const id = userData._id || userData.id || 'usr-' + Date.now();
    const cleanEmail = (userData.email || '').toLowerCase().trim();
    const existingIndex = usersList.findIndex(
      (u) => String(u._id || u.id) === String(id) || (cleanEmail && u.email && u.email.toLowerCase().trim() === cleanEmail)
    );

    const userToSave = {
      ...userData,
      _id: id,
      email: cleanEmail,
      updatedAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      usersList[existingIndex] = { ...usersList[existingIndex], ...userToSave };
    } else {
      userToSave.createdAt = userToSave.createdAt || new Date().toISOString();
      usersList.push(userToSave);
    }

    writeJsonFile(USERS_FILE, usersList);
    return userToSave;
  },

  // SPOTS
  getAllSpots() {
    return [...spotsList];
  },

  getSpotById(id) {
    if (!id) return null;
    return spotsList.find((s) => String(s._id || s.id) === String(id)) || null;
  },

  saveSpot(spotData) {
    const id = spotData._id || spotData.id || 'spot-' + Date.now() + '-' + Math.floor(100 + Math.random() * 900);
    const existingIndex = spotsList.findIndex((s) => String(s._id || s.id) === String(id));

    const spotToSave = {
      ...spotData,
      _id: id,
      updatedAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      spotsList[existingIndex] = { ...spotsList[existingIndex], ...spotToSave };
    } else {
      spotToSave.createdAt = spotToSave.createdAt || new Date().toISOString();
      spotToSave.isActive = spotToSave.isActive !== undefined ? spotToSave.isActive : true;
      spotsList.unshift(spotToSave);
    }

    writeJsonFile(SPOTS_FILE, spotsList);
    return spotToSave;
  },

  deleteSpot(id) {
    const beforeCount = spotsList.length;
    spotsList = spotsList.filter((s) => String(s._id || s.id) !== String(id));
    if (spotsList.length !== beforeCount) {
      writeJsonFile(SPOTS_FILE, spotsList);
      return true;
    }
    return false;
  },

  // BOOKINGS
  getAllBookings() {
    return [...bookingsList];
  },

  getBookingById(id) {
    if (!id) return null;
    return bookingsList.find((b) => String(b._id || b.id) === String(id)) || null;
  },

  saveBooking(bookingData) {
    const id = bookingData._id || bookingData.id || 'bk-' + Date.now() + '-' + Math.floor(1000 + Math.random() * 9000);
    const existingIndex = bookingsList.findIndex((b) => String(b._id || b.id) === String(id));

    const bookingToSave = {
      ...bookingData,
      _id: id,
      updatedAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      bookingsList[existingIndex] = { ...bookingsList[existingIndex], ...bookingToSave };
    } else {
      bookingToSave.createdAt = bookingToSave.createdAt || new Date().toISOString();
      bookingToSave.status = bookingToSave.status || 'CONFIRMED';
      bookingsList.unshift(bookingToSave);
    }

    writeJsonFile(BOOKINGS_FILE, bookingsList);
    return bookingToSave;
  },
};
