// Robust multi-tier location resolver with hardware GPS, network WiFi, GeoIP fallback, and reverse geocoding

export const LOCATION_PRESETS = [
  { id: 'vallam', name: 'Vallam, Thanjavur', lat: 10.7181, lng: 79.0849, tag: 'Campus & Main Rd' },
  { id: 'thanjavur_junction', name: 'Thanjavur Junction', lat: 10.7867, lng: 79.1378, tag: 'Old Bus Stand' },
  { id: 'thanjavur_mc', name: 'Medical College Rd', lat: 10.7632, lng: 79.1219, tag: 'Thanjavur' },
  { id: 'trichy', name: 'Trichy Central', lat: 10.7905, lng: 78.7047, tag: 'Railway Junction' },
  { id: 'tnagar', name: 'T. Nagar, Chennai', lat: 13.0418, lng: 80.2341, tag: 'Usman Rd' },
  { id: 'annanagar', name: 'Anna Nagar, Chennai', lat: 13.0850, lng: 80.2101, tag: 'Roundtana' },
  { id: 'coimbatore', name: 'Coimbatore Junction', lat: 11.0016, lng: 76.9629, tag: 'Gandhipuram' },
  { id: 'bengaluru', name: 'Koramangala, BLR', lat: 12.9352, lng: 77.6245, tag: '80ft Road' },
];

export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Reverse geocode lat/lng to human-readable address
export async function reverseGeocode(lat, lng) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      { headers: { 'User-Agent': 'NammaSpots-App/2.0' }, signal: controller.signal }
    ).then((r) => r.json());
    clearTimeout(timer);

    if (res && res.address) {
      const a = res.address;
      const locality = a.suburb || a.village || a.neighbourhood || a.road || a.town || a.city || '';
      const city = a.city || a.town || a.county || a.state_district || 'Tamil Nadu';
      const postcode = a.postcode || '';
      return {
        label: locality ? `${locality}, ${city}` : city,
        area: locality,
        city,
        pincode: postcode,
        fullAddress: res.display_name || '',
      };
    }
  } catch {}

  // Fallback reverse geocoder
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res2 = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
      { signal: controller.signal }
    ).then((r) => r.json());
    clearTimeout(timer);

    if (res2 && (res2.locality || res2.city)) {
      const locality = res2.locality || '';
      const city = res2.city || res2.principalSubdivision || 'Tamil Nadu';
      return {
        label: locality ? `${locality}, ${city}` : city,
        area: locality,
        city,
        pincode: res2.postcode || '',
        fullAddress: `${locality}, ${city}, India`,
      };
    }
  } catch {}

  return {
    label: `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`,
    area: '',
    city: 'Tamil Nadu',
    pincode: '',
    fullAddress: '',
  };
}

// Multi-tier user location resolver:
// 1. Hardware GPS (High Accuracy)
// 2. Network / WiFi Geolocation (Standard Accuracy)
// 3. IP-based Geolocation fallback
export async function resolveUserLocation() {
  // Helper for navigator.geolocation wrapped in promise
  const tryGeo = (options) =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        return reject(new Error('Geolocation not supported'));
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });

  let lat = null;
  let lng = null;
  let accuracy = null;
  let tier = 'gps';

  // Tier 1: High Accuracy GPS (5s timeout)
  try {
    const pos = await tryGeo({ enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 });
    lat = pos.coords.latitude;
    lng = pos.coords.longitude;
    accuracy = pos.coords.accuracy;
    tier = 'high-precision GPS';
  } catch {
    // Tier 2: Standard Network / WiFi accuracy (6s timeout)
    try {
      const pos2 = await tryGeo({ enableHighAccuracy: false, timeout: 6000, maximumAge: 300000 });
      lat = pos2.coords.latitude;
      lng = pos2.coords.longitude;
      accuracy = pos2.coords.accuracy;
      tier = 'network geolocation';
    } catch {
      // Tier 3: IP-based Geolocation fallback
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);
        const ipRes = await fetch('https://ipapi.co/json/', { signal: controller.signal }).then((r) => r.json());
        clearTimeout(timer);
        if (ipRes && ipRes.latitude && ipRes.longitude) {
          lat = parseFloat(ipRes.latitude);
          lng = parseFloat(ipRes.longitude);
          tier = 'IP location';
        }
      } catch {}
    }
  }

  // If still not found, default to Vallam / Thanjavur
  if (!lat || !lng) {
    return {
      lat: 10.7181,
      lng: 79.0849,
      label: 'Vallam / Thanjavur, Tamil Nadu',
      area: 'Vallam',
      city: 'Thanjavur',
      pincode: '613403',
      accuracy: null,
      tier: 'default region',
      isFallback: true,
    };
  }

  // Reverse geocode to get human address
  const geoDetails = await reverseGeocode(lat, lng);

  return {
    lat,
    lng,
    label: geoDetails.label,
    area: geoDetails.area,
    city: geoDetails.city,
    pincode: geoDetails.pincode,
    fullAddress: geoDetails.fullAddress,
    accuracy: accuracy ? Math.round(accuracy) : null,
    tier,
    isFallback: false,
  };
}

// Search coordinates by street name, town, landmark or pincode
export async function searchLocationByQuery(query) {
  const clean = (query || '').trim().toLowerCase();
  if (!clean) return null;

  // 1. Direct landmark dictionary match
  const presetMatch = LOCATION_PRESETS.find(
    (p) => p.name.toLowerCase().includes(clean) || clean.includes(p.name.toLowerCase())
  );
  if (presetMatch) {
    return {
      lat: presetMatch.lat,
      lng: presetMatch.lng,
      label: presetMatch.name,
      area: presetMatch.name.split(',')[0],
      city: presetMatch.name.split(',')[1]?.trim() || 'Tamil Nadu',
      pincode: '',
    };
  }

  // 2. OpenStreetMap Nominatim with India bounds
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=in&limit=5&addressdetails=1`,
      { headers: { 'User-Agent': 'NammaSpots-App/2.0' }, signal: controller.signal }
    ).then((r) => r.json());
    clearTimeout(timer);

    if (res && res.length > 0) {
      const top = res[0];
      const newLat = parseFloat(top.lat);
      const newLng = parseFloat(top.lon);
      const parts = top.display_name.split(',').map((p) => p.trim());
      const label = parts.slice(0, 3).join(', ');
      return {
        lat: newLat,
        lng: newLng,
        label,
        area: parts[0] || '',
        city: parts[1] || 'Tamil Nadu',
        pincode: top.address?.postcode || '',
      };
    }
  } catch {}

  // 3. Fallback Nominatim with Tamil Nadu regional context
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res2 = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Tamil Nadu')}&countrycodes=in&limit=1`,
      { headers: { 'User-Agent': 'NammaSpots-App/2.0' }, signal: controller.signal }
    ).then((r) => r.json());
    clearTimeout(timer);

    if (res2 && res2.length > 0) {
      const top = res2[0];
      const newLat = parseFloat(top.lat);
      const newLng = parseFloat(top.lon);
      const label = top.display_name.split(',').slice(0, 3).join(', ');
      return {
        lat: newLat,
        lng: newLng,
        label,
        area: '',
        city: 'Tamil Nadu',
        pincode: '',
      };
    }
  } catch {}

  return null;
}
