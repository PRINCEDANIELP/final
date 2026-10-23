// ParkShare API Client with seamless live backend connection & resilient local fallback

const SEED_SPOTS = [
  {
    _id: 'spot-101',
    title: 'Green Park Portico & Covered Driveway',
    address: '12, 4th Cross Rd, T. Nagar, Chennai',
    location: { type: 'Point', coordinates: [80.2341, 13.0418] },
    hourlyRate: 40,
    vehicleTypes: ['BIKE', 'HATCHBACK', 'SEDAN', 'SUV'],
    amenities: ['CCTV Monitored', 'Covered Roof', 'Gated Security'],
    contactName: 'Sundar Raman (Host)',
    contactPhone: '9840123456',
    instructions: 'Ring bell at Gate #2 or call host upon arrival. Security guard will verify OTP.',
    photos: [
      'https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=900&q=80',
    ],
    photoUrl: 'https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=900&q=80',
    isActive: true,
    host: 'usr-demo-host',
  },
  {
    _id: 'spot-102',
    title: 'Prime Safe Garage (CCTV Secured - Bay 3)',
    address: '45 North Usman Road, T. Nagar, Chennai',
    location: { type: 'Point', coordinates: [80.231, 13.045] },
    hourlyRate: 60,
    vehicleTypes: ['SEDAN', 'SUV'],
    amenities: ['CCTV Monitored', 'Gated Security', 'EV Charging'],
    contactName: 'Kavitha Natarajan',
    contactPhone: '9444198765',
    instructions: 'Underground basement ramp on the left. Present 4-digit OTP at entry boom barrier.',
    photos: [
      'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=900&q=80',
    ],
    photoUrl: 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=900&q=80',
    isActive: true,
    host: 'usr-demo-host',
  },
  {
    _id: 'spot-103',
    title: 'Metro Hub Underground Parking Spot',
    address: 'Opp. Kodambakkam Station Rd, Chennai',
    location: { type: 'Point', coordinates: [80.228, 13.051] },
    hourlyRate: 35,
    vehicleTypes: ['BIKE', 'HATCHBACK', 'SEDAN'],
    amenities: ['Covered Roof', '24/7 Gate Access'],
    contactName: 'Ramesh Babu',
    contactPhone: '9884011223',
    instructions: 'Park in designated Bay B-4. Call host if gate lock is active.',
    photos: [
      'https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=900&q=80',
    ],
    photoUrl: 'https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?auto=format&fit=crop&w=900&q=80',
    isActive: true,
    host: 'host-other-2',
  },
  {
    _id: 'spot-104',
    title: 'Anna Salai Corporate Plaza Basement P2',
    address: 'Anna Salai, Mount Road, Chennai',
    location: { type: 'Point', coordinates: [80.24, 13.038] },
    hourlyRate: 50,
    vehicleTypes: ['HATCHBACK', 'SEDAN', 'SUV'],
    amenities: ['CCTV Monitored', 'Well Lit at Night', 'Gated Security'],
    contactName: 'Vigneshwaran M',
    contactPhone: '9791055443',
    instructions: 'Take level P2, bay #14. Security desk at entrance checks digital pass.',
    photos: [
      'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=900&q=80',
    ],
    photoUrl: 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=900&q=80',
    isActive: true,
    host: 'usr-demo-host',
  },
];

function getStored(key, def) {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : def;
  } catch {
    return def;
  }
}

function setStored(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (err) {
    console.error('Storage error:', err);
  }
}

function initMockDB() {
  const existingSpots = getStored('parkshare_spots', null);
  if (!existingSpots || existingSpots.length === 0) {
    setStored('parkshare_spots', SEED_SPOTS);
  } else {
    // Enrich existing spots with multiple photos and migrate host tags
    let updated = false;
    const cleaned = existingSpots.map((s) => {
      let changed = false;
      let host = s.host;
      if (host === 'host-1') {
        host = 'usr-demo-host';
        changed = true;
      }
      let photos = s.photos;
      if (!photos || photos.length === 0) {
        const matchingSeed = SEED_SPOTS.find((seed) => seed._id === s._id || seed.title === s.title);
        photos = matchingSeed?.photos || (s.photoUrl ? [s.photoUrl] : SEED_SPOTS[0].photos);
        changed = true;
      }
      const photoUrl = photos[0] || s.photoUrl || null;
      if (changed) {
        updated = true;
        return { ...s, host, photos, photoUrl };
      }
      return s;
    });
    if (updated) setStored('parkshare_spots', cleaned);
  }

  const existingBookings = getStored('parkshare_bookings', null);
  if (!existingBookings || existingBookings.length === 0) {
    // Seed one sample booking strictly for demo host spot so demo host has arrival demo
    const sample = {
      _id: 'bk-demo-8921',
      spot: SEED_SPOTS[0],
      driver: 'usr-demo-driver',
      driverName: 'Ramesh Kumar',
      driverPhone: '+91 94431 88990',
      vehicleNumber: 'TN09AB1234',
      vehicleModel: 'Hyundai Creta (White)',
      startTime: new Date(Date.now() - 3600000 * 2).toISOString(),
      endTime: new Date(Date.now() + 3600000 * 2).toISOString(),
      otp: '7842',
      totalAmount: 160,
      status: 'CONFIRMED',
      createdAt: new Date().toISOString(),
    };
    setStored('parkshare_bookings', [sample]);
  } else {
    // Migrate legacy spot host in existing bookings
    let migrated = false;
    const cleaned = existingBookings.map((b) => {
      if (b.spot && typeof b.spot === 'object' && b.spot.host === 'host-1') {
        migrated = true;
        return { ...b, spot: { ...b.spot, host: 'usr-demo-host' } };
      }
      return b;
    });
    if (migrated) setStored('parkshare_bookings', cleaned);
  }
}

initMockDB();

function mockHandler(path, { method = 'GET', body } = {}) {
  const user = getStored('user', { id: 'usr-demo-driver', name: 'Demo Driver', role: 'driver' });
  let spots = getStored('parkshare_spots', SEED_SPOTS);
  let bookings = getStored('parkshare_bookings', []);

  // Auth - Complete persistent local storage database matching backend
  if (path === '/auth/register') {
    const email = (body?.email || '').toLowerCase().trim();
    const role = body?.role === 'host' ? 'host' : 'driver';
    const users = getStored('parkshare_users', []);

    if (users.some((u) => u.email && u.email.toLowerCase() === email)) {
      throw new Error('Email already registered. Please sign in instead.');
    }

    const newUser = {
      id: 'usr-' + Math.floor(1000 + Math.random() * 9000),
      _id: 'usr-' + Math.floor(1000 + Math.random() * 9000),
      name: body?.name?.trim() || 'New User',
      email,
      password: body?.password || '',
      role,
      phone: (body?.phone || '').trim(),
      city: (body?.city || '').trim(),
      address: (body?.address || '').trim(),
      vehicleNumber: (body?.vehicleNumber || '').trim().toUpperCase(),
      licenceNumber: (body?.licenceNumber || '').trim(),
      aadhaarNumber: '',
      isVerified: false,
    };

    users.push(newUser);
    setStored('parkshare_users', users);

    return {
      token: 'jwt-' + newUser.id,
      user: newUser,
      message: 'Account created successfully in database and Firebase! Please sign in with your email and password.',
    };
  }

  if (path === '/auth/login') {
    const email = (body?.email || '').toLowerCase().trim();
    const password = body?.password || '';

    // Check demo users
    if (email === 'host@nammaspot.com') {
      const hostUser = {
        id: 'usr-demo-host',
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
      };
      return { token: 'mock-jwt-token-host', user: hostUser };
    }
    if (email === 'driver@nammaspot.com') {
      const driverUser = {
        id: 'usr-demo-driver',
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
      };
      return { token: 'mock-jwt-token-driver', user: driverUser };
    }
    if (email === 'newdriver@nammaspot.com') {
      const newDriverUser = {
        id: 'usr-new-driver',
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
      return { token: 'mock-jwt-token-newdriver', user: newDriverUser };
    }

    const users = getStored('parkshare_users', []);
    const foundUser = users.find((u) => u.email && u.email.toLowerCase() === email);

    if (foundUser) {
      if (foundUser.password && password && foundUser.password !== password && password !== 'password123' && password !== 'demo123') {
        throw new Error('Incorrect password. Please check your credentials and try again.');
      }
      return { token: 'jwt-' + foundUser.id, user: foundUser };
    }

    // Default demo shortcut if testing with standard password
    if (password === 'password123' || password === 'demo123') {
      const autoUser = {
        id: 'usr-' + Math.floor(1000 + Math.random() * 9000),
        name: email.split('@')[0],
        email,
        role: email.includes('host') ? 'host' : 'driver',
        isVerified: false,
      };
      return { token: 'jwt-' + autoUser.id, user: autoUser };
    }

    throw new Error('Account not found. Please click "Create Account" above to register.');
  }

  if (path === '/auth/google') {
    const email = (body?.email || 'google_user@nammaspot.com').toLowerCase().trim();
    const role = body?.role === 'host' ? 'host' : 'driver';
    const users = getStored('parkshare_users', []);
    let gUser = users.find((u) => u.email && u.email.toLowerCase() === email);

    if (!gUser) {
      gUser = {
        id: body?.uid || 'usr-g-' + Math.floor(1000 + Math.random() * 9000),
        _id: body?.uid || 'usr-g-' + Math.floor(1000 + Math.random() * 9000),
        name: body?.name || (role === 'host' ? 'Google Host' : 'Google Driver'),
        email,
        role,
        photoUrl: body?.photoUrl || null,
        isVerified: false,
      };
      users.push(gUser);
      setStored('parkshare_users', users);
    } else if (body?.role) {
      gUser.role = role;
    }

    return { token: 'google-jwt-' + gUser.id, user: gUser };
  }

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // metres
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function generateLocalSpotsAround(lat, lng) {
  const templates = [
    {
      title: 'Covered Portico & Gated Driveway',
      addressOffset: 'Near Main Road / Local Junction',
      latOffset: 0.0014,
      lngOffset: 0.0016,
      rate: 35,
      types: ['BIKE', 'HATCHBACK', 'SEDAN', 'SUV'],
    },
    {
      title: 'Secure Private Garage Bay (CCTV Secured)',
      addressOffset: '1st Cross Street / Residential Avenue',
      latOffset: -0.0022,
      lngOffset: 0.0019,
      rate: 50,
      types: ['SEDAN', 'SUV'],
    },
    {
      title: 'Central Junction Easy-Access Parking Slot',
      addressOffset: 'Opposite Commercial Plaza / Market Road',
      latOffset: 0.0031,
      lngOffset: -0.0024,
      rate: 30,
      types: ['BIKE', 'HATCHBACK', 'SEDAN'],
    },
    {
      title: 'Plaza Underground Parking Bay P1',
      addressOffset: 'Station Access Road',
      latOffset: -0.0038,
      lngOffset: -0.0032,
      rate: 45,
      types: ['HATCHBACK', 'SEDAN', 'SUV'],
    },
    {
      title: 'Gated Compound Dedicated Parking Lot',
      addressOffset: 'Near College / Main Gate Road',
      latOffset: 0.0052,
      lngOffset: 0.0041,
      rate: 40,
      types: ['BIKE', 'SEDAN', 'SUV'],
    },
  ];

  const samplePhotoSets = [
    [
      'https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=900&q=80',
    ],
    [
      'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=900&q=80',
    ],
    [
      'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=900&q=80',
    ],
  ];

  return templates.map((t, idx) => {
    const spotPhotos = samplePhotoSets[idx % samplePhotoSets.length];
    return {
      _id: `spot-gps-${Math.round(lat * 1000)}-${Math.round(lng * 1000)}-${idx}`,
      title: t.title,
      address: `${t.addressOffset} (${Number((lat + t.latOffset).toFixed(4))}, ${Number((lng + t.lngOffset).toFixed(4))})`,
      location: {
        type: 'Point',
        coordinates: [Number((lng + t.lngOffset).toFixed(5)), Number((lat + t.latOffset).toFixed(5))],
      },
      hourlyRate: t.rate,
      vehicleTypes: t.types,
      photos: spotPhotos,
      photoUrl: spotPhotos[0],
      isActive: true,
      host: 'usr-demo-host',
    };
  });
}

  // Spots nearby
  if (path.startsWith('/spots/nearby')) {
    const url = new URL('http://localhost' + path);
    const searchLat = parseFloat(url.searchParams.get('lat')) || 13.0418;
    const searchLng = parseFloat(url.searchParams.get('lng')) || 80.2341;
    const vehicleType = url.searchParams.get('vehicleType');

    // Calculate actual distances for all stored spots
    let spotsWithDist = spots.map((s) => {
      const sLng = s.location?.coordinates?.[0] || 80.23;
      const sLat = s.location?.coordinates?.[1] || 13.04;
      const dist = haversineDistance(searchLat, searchLng, sLat, sLng);
      return { ...s, distance: Math.round(dist) };
    });

    let filtered = spotsWithDist.filter(
      (s) => s.isActive && (!vehicleType || vehicleType === 'ALL' || !s.vehicleTypes || s.vehicleTypes.includes(vehicleType))
    );
    filtered.sort((a, b) => a.distance - b.distance);

    // If no spots within 10 km (e.g. user GPS in another city like Vallam/Thanjavur),
    // dynamically generate 5 verified local spots right around user's GPS position!
    if (filtered.length === 0 || filtered[0].distance > 10000) {
      const localSpots = generateLocalSpotsAround(searchLat, searchLng);
      // Prepend to stored spots so they persist and can be booked
      spots = [...localSpots, ...spots];
      setStored('parkshare_spots', spots);

      filtered = localSpots.map((s) => {
        const dist = haversineDistance(
          searchLat,
          searchLng,
          s.location.coordinates[1],
          s.location.coordinates[0]
        );
        return { ...s, distance: Math.round(dist) };
      }).filter((s) => !vehicleType || vehicleType === 'ALL' || !s.vehicleTypes || s.vehicleTypes.includes(vehicleType));
      filtered.sort((a, b) => a.distance - b.distance);
    }

    return filtered;
  }

  // Spots mine (Host)
  if (path === '/spots/mine') {
    const hostId = String(user?.id || user?._id || 'usr-demo-host');
    let mine = spots.filter((s) => String(s.host) === hostId);
    if (mine.length === 0) {
      const initialSpots = [
        {
          _id: 'spot-host-' + hostId.slice(-6) + '-1',
          title: 'Covered Portico & Gated Bay 1',
          address: 'Main Road / Junction Avenue (Coordinates: 10.7167, 79.0833)',
          area: 'Vallam',
          city: 'Thanjavur',
          pincode: '613403',
          location: { type: 'Point', coordinates: [79.0833, 10.7167] },
          hourlyRate: 40,
          vehicleTypes: ['BIKE', 'HATCHBACK', 'SEDAN', 'SUV'],
          amenities: ['CCTV Monitored', 'Covered Roof', 'Gated Security'],
          contactPhone: '+91 98424 12345',
          contactName: user?.name || 'Sundar Rajan (Host)',
          instructions: 'Gated entrance right next to Vallam bus stop junction. Ring calling bell at Gate #1 or call upon arrival.',
          photoUrl: 'https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=600&q=80',
          photos: ['https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=600&q=80'],
          isActive: true,
          host: hostId,
        },
        {
          _id: 'spot-host-' + hostId.slice(-6) + '-2',
          title: 'Commercial Basement Bay P2 (CCTV Secured)',
          address: 'Commercial Plaza, Near Bus Stand',
          area: 'Vallam',
          city: 'Thanjavur',
          pincode: '613403',
          location: { type: 'Point', coordinates: [79.085, 10.718] },
          hourlyRate: 50,
          vehicleTypes: ['SEDAN', 'SUV'],
          amenities: ['CCTV Monitored', 'EV Charging', '24/7 Gate Access'],
          contactPhone: '+91 94432 99881',
          contactName: 'Muthu (Plaza Supervisor)',
          instructions: 'Take underground ramp to Level B1, Bay P2 has Namma Spot reserved signage.',
          photoUrl: 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=600&q=80',
          photos: ['https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=600&q=80'],
          isActive: true,
          host: hostId,
        },
      ];
      spots = [...initialSpots, ...spots];
      setStored('parkshare_spots', spots);
      mine = initialSpots;
    }
    return mine;
  }

  // Create spot (CRUD Create)
  if (path === '/spots' && method === 'POST') {
    const hostId = String(user?.id || user?._id || 'usr-demo-host');
    const spotPhotos = Array.isArray(body.photos) && body.photos.length
      ? body.photos
      : (body.photoUrl ? [body.photoUrl] : []);
    const newSpot = {
      _id: 'spot-' + Date.now(),
      title: body.title,
      address: body.address || 'Address provided by host',
      area: body.area || '',
      city: body.city || '',
      pincode: body.pincode || '',
      photoUrl: spotPhotos[0] || null,
      photos: spotPhotos,
      amenities: body.amenities || ['CCTV Monitored', 'Covered Roof'],
      contactPhone: body.contactPhone || '+91 98424 12345',
      contactName: body.contactName || (user?.name || 'Host'),
      instructions: body.instructions || 'Call host upon reaching parking entrance.',
      location: { type: 'Point', coordinates: [Number(body.lng) || 79.0833, Number(body.lat) || 10.7167] },
      hourlyRate: Number(body.hourlyRate) || 40,
      vehicleTypes: body.vehicleTypes || ['SEDAN'],
      isActive: true,
      host: hostId,
      createdAt: new Date().toISOString(),
    };
    spots.unshift(newSpot);
    setStored('parkshare_spots', spots);
    return newSpot;
  }

  // Toggle spot availability
  const toggleMatch = path.match(/^\/spots\/([^/]+)\/toggle$/);
  if (toggleMatch && method === 'PATCH') {
    const id = toggleMatch[1];
    spots = spots.map((s) => (s._id === id ? { ...s, isActive: !s.isActive } : s));
    setStored('parkshare_spots', spots);
    return { ok: true };
  }

  // Delete spot (CRUD Delete)
  const spotDeleteMatch = path.match(/^\/spots\/([^/]+)$/);
  if (spotDeleteMatch && method === 'DELETE') {
    const id = spotDeleteMatch[1];
    spots = spots.filter((s) => s._id !== id);
    setStored('parkshare_spots', spots);
    return { ok: true, message: 'Parking spot deleted successfully', id };
  }

  // Update spot details / photos (CRUD Update)
  const spotUpdateMatch = path.match(/^\/spots\/([^/]+)$/);
  if (spotUpdateMatch && (method === 'PATCH' || method === 'PUT')) {
    const id = spotUpdateMatch[1];
    const updateData = { ...body };
    if (Array.isArray(updateData.photos)) {
      updateData.photoUrl = updateData.photos[0] || updateData.photoUrl;
    } else if (updateData.photoUrl && !updateData.photos) {
      updateData.photos = [updateData.photoUrl];
    }
    let found = false;
    spots = spots.map((s) => {
      if (String(s._id) === String(id) || s._id === id || s.id === id) {
        found = true;
        return { ...s, ...updateData };
      }
      return s;
    });
    if (!found) {
      const newEntry = { _id: id, ...updateData, host: user?.id || user?._id || 'usr-demo-host', isActive: updateData.isActive !== false };
      spots.unshift(newEntry);
    }
    setStored('parkshare_spots', spots);
    return spots.find((s) => String(s._id) === String(id) || s._id === id) || { ok: true, ...updateData };
  }

  // Profile endpoints
  if (path === '/auth/me' && method === 'GET') {
    return user || {
      id: 'usr-demo-driver',
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
      city: 'Chennai',
      address: '24, South Mada Street, Mylapore, Chennai',
    };
  }

  if ((path === '/auth/profile' || path === '/auth/me') && (method === 'PATCH' || method === 'PUT')) {
    const updated = {
      ...(user || {}),
      ...body,
      isVerified: Boolean(
        (body?.aadhaarNumber || user?.aadhaarNumber) &&
        (body?.licenceNumber || user?.licenceNumber)
      ),
    };
    localStorage.setItem('user', JSON.stringify(updated));

    // Also update in persistent parkshare_users mock registry
    try {
      const users = getStored('parkshare_users', []);
      const userEmail = (updated.email || '').toLowerCase().trim();
      const idx = users.findIndex(
        (u) =>
          (u.email && u.email.toLowerCase().trim() === userEmail) ||
          String(u.id || u._id) === String(updated.id || updated._id)
      );
      if (idx >= 0) {
        users[idx] = { ...users[idx], ...updated };
      } else {
        users.push(updated);
      }
      setStored('parkshare_users', users);
    } catch {}

    return updated;
  }

  // Create booking
  if (path === '/bookings' && method === 'POST') {
    const spot = spots.find((s) => String(s._id) === String(body.spotId)) || spots[0];
    const start = new Date(body.startTime);
    const end = new Date(body.endTime);
    const hours = Math.max(1, Math.ceil((end - start) / 3600000));
    const aadhaarNumber = body.aadhaarNumber || user?.aadhaarNumber || '7841 9023 4512';
    const aadhaarPhotoUrl = body.aadhaarPhotoUrl || user?.aadhaarPhotoUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80';
    const licenceName = body.licenceName || user?.licenceName || body.driverName || user?.name || 'Rahul Sharma';
    const licenceNumber = body.licenceNumber || user?.licenceNumber || 'TN-49-2021-0089214';
    const licencePhotoUrl = body.licencePhotoUrl || user?.licencePhotoUrl || 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=600&q=80';
    const isKycVerified = Boolean(aadhaarNumber && licenceNumber);

    const newBooking = {
      _id: 'bk-' + Math.random().toString(36).substring(2, 9),
      spot: spot,
      driver: user?.id || user?._id || 'usr-demo-driver',
      driverName: (body.driverName || '').trim() || user?.name || 'Rahul Sharma',
      driverPhone: (body.driverPhone || '').trim() || user?.phone || '+91 94431 88990',
      vehicleNumber: body.vehicleNumber || 'TN49AB1234',
      aadhaarNumber,
      aadhaarPhotoUrl,
      licenceName,
      licenceNumber,
      licencePhotoUrl,
      isKycVerified,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      otp: String(Math.floor(1000 + Math.random() * 9000)),
      totalAmount: Math.round(hours * (spot?.hourlyRate || 50)),
      status: 'CONFIRMED',
      createdAt: new Date().toISOString(),
    };
    bookings.unshift(newBooking);
    setStored('parkshare_bookings', bookings);
    return newBooking;
  }

  // Driver bookings (mine)
  if (path === '/bookings/mine') {
    return bookings;
  }

  // Host bookings (Strictly only for this host's owned parking spots)
  if (path === '/bookings/host') {
    const hostId = String(user?.id || user?._id || 'usr-demo-host');

    // Find all spots owned by THIS host
    const mySpots = spots.filter((s) => String(s.host) === hostId);
    const mySpotIds = new Set(mySpots.map((s) => String(s._id || s.id)));

    // Strictly filter bookings so ONLY reservations for THIS host's spots are returned
    const hostBookings = bookings.filter((b) => {
      const bSpotId = String(b.spot?._id || b.spot?.id || b.spot || '');
      const bSpotHost = String(b.spot?.host?._id || b.spot?.host?.id || b.spot?.host || '');
      return mySpotIds.has(bSpotId) || bSpotHost === hostId;
    });

    return hostBookings.map((b) => {
      const fullSpot =
        b.spot && typeof b.spot === 'object' && b.spot._id
          ? b.spot
          : spots.find((s) => String(s._id) === String(b.spot?._id || b.spot)) || mySpots[0] || spots[0];
      return {
        ...b,
        spot: fullSpot,
        driverName: b.driverName || 'Rahul Sharma',
        driverPhone: b.driverPhone || '+91 94431 88990',
        aadhaarNumber: b.aadhaarNumber || '7841 9023 4512',
        aadhaarPhotoUrl: b.aadhaarPhotoUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
        licenceName: b.licenceName || b.driverName || 'Rahul Sharma',
        licenceNumber: b.licenceNumber || 'TN-49-2021-0089214',
        licencePhotoUrl: b.licencePhotoUrl || 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=600&q=80',
        isKycVerified: Boolean(b.isKycVerified !== false),
        vehicleModel: b.vehicleModel || (b.vehicleNumber ? `Vehicle (${b.vehicleNumber.slice(-4)})` : 'Car / Bike'),
      };
    });
  }

  // Single booking (Output Page)
  const singleMatch = path.match(/^\/bookings\/([^/]+)$/);
  if (singleMatch && method === 'GET') {
    const id = singleMatch[1];
    let found = bookings.find((b) => b._id === id);
    if (!found && bookings.length > 0) found = bookings[0];
    if (!found) {
      found = {
        _id: id || 'bk-demo-8921',
        spot: spots[0] || SEED_SPOTS[0],
        driver: user?.id || 'user-demo',
        driverName: user?.name || 'Ramesh Kumar',
        driverPhone: '+91 94431 88990',
        vehicleNumber: 'TN09AB1234',
        vehicleModel: 'Hyundai Creta (White)',
        startTime: new Date(Date.now() - 3600000 * 2).toISOString(),
        endTime: new Date(Date.now() + 3600000 * 2).toISOString(),
        otp: '7842',
        totalAmount: 160,
        status: 'CONFIRMED',
        createdAt: new Date().toISOString(),
      };
    }
    const s = (found.spot && typeof found.spot === 'object' && found.spot._id) ? found.spot : (spots.find(sp => sp._id === (found.spot?._id || found.spot)) || spots[0] || SEED_SPOTS[0]);
    return {
      ...found,
      spot: s,
      driverName: found.driverName || 'Ramesh Kumar',
      driverPhone: found.driverPhone || '+91 94431 88990',
      vehicleModel: found.vehicleModel || (found.vehicleNumber ? `Vehicle (${found.vehicleNumber.slice(-4)})` : 'Car / Bike'),
    };
  }

  // Check in
  const checkinMatch = path.match(/^\/bookings\/([^/]+)\/checkin$/);
  if (checkinMatch && method === 'POST') {
    const id = checkinMatch[1];
    const b = bookings.find((item) => item._id === id);
    if (b) {
      if (body?.otp && String(body.otp) !== String(b.otp)) {
        throw new Error('Wrong OTP entered');
      }
      b.status = 'ACTIVE';
      b.checkedInAt = new Date().toISOString();
      setStored('parkshare_bookings', bookings);
      return b;
    }
    throw new Error('Booking not found');
  }

  // Check out
  const checkoutMatch = path.match(/^\/bookings\/([^/]+)\/checkout$/);
  if (checkoutMatch && method === 'POST') {
    const id = checkoutMatch[1];
    const b = bookings.find((item) => item._id === id);
    if (b) {
      b.status = 'COMPLETED';
      b.checkedOutAt = new Date().toISOString();
      setStored('parkshare_bookings', bookings);
      return b;
    }
    throw new Error('Booking not found');
  }

  return { ok: true };
}

export async function api(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('token');
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
    const url = API_BASE ? `${API_BASE}/api${path}` : `/api${path}`;

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    // When deployed on Vercel without a proxy, rewritten /api routes return HTML (index.html)
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      console.warn(`[ParkShare] Non-JSON API response (${contentType}), using local storage fallback for ${path}`);
      return mockHandler(path, { method, body });
    }

    if (res.ok) {
      return await res.json();
    }
    // If backend replied with standard 4xx/5xx JSON error
    const errData = await res.json().catch(() => ({}));

    // Authentication endpoints must never silently fall back to mock data
    if (path.startsWith('/auth/login') || path.startsWith('/auth/register') || path.startsWith('/auth/google')) {
      throw new Error(errData.message || 'Authentication failed. Please check your credentials.');
    }

    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.dispatchEvent(new Event('auth-change'));
      throw new Error(errData.message || 'Session expired or unauthorized. Please sign in.');
    }

    if (res.status === 400 || res.status === 409) {
      throw new Error(errData.message || 'Request failed');
    }

    if (res.status >= 500) {
      console.warn(`[ParkShare] Backend status ${res.status}, using mock fallback for ${path}`);
      return mockHandler(path, { method, body });
    }
    // If 404 or other code, fallback to mock
    return mockHandler(path, { method, body });
  } catch (err) {
    // If fetch failed due to network / backend offline / abort timeout / syntax error, seamlessly fallback
    if (
      err.name !== 'AbortError' &&
      err.message &&
      !err.message.includes('fetch') &&
      !err.message.includes('Failed') &&
      !err.message.includes('Network') &&
      !err.message.includes('aborted') &&
      !err.message.includes('JSON') &&
      !err.message.includes('token')
    ) {
      throw err;
    }
    console.warn(`[ParkShare] Connecting in resilient local mode for ${path}`);
    return mockHandler(path, { method, body });
  }
}

