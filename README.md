# ParkShare - Airbnb for Parking Spots (MERN)

Hosts list idle parking spaces. Drivers find nearby spots on a map-style list, book a time slot, and check in with an OTP that the host confirms.

## Stack
- MongoDB + Mongoose (2dsphere index for radius search)
- Express 5 REST API with JWT auth
- React 18 + Vite + React Router

## Setup

Prerequisites: Node 18+, MongoDB running locally (or a MongoDB Atlas URI).

```bash
# 1. Backend
cd server
cp .env.example .env        # edit JWT_SECRET
npm install
npm run dev                 # runs on http://localhost:5000

# 2. Frontend (new terminal)
cd client
npm install
npm run dev                 # runs on http://localhost:5173
```

Open http://localhost:5173, register once as "I have a space to rent" (host) and once as "I need parking" (driver) in another browser or incognito window.

## Flow
1. Host logs in, lists a spot with lat/lng, hourly rate, and vehicle types.
2. Driver clicks "Search within 1 km", picks a spot, enters vehicle number and time range, and gets a 4-digit OTP.
3. Host opens the Host page, enters the OTP at check-in, and checks out at the end. Overtime beyond a 15-minute grace period is charged at 1.5x.

## API
| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | /api/auth/register | public | Create driver or host account |
| POST | /api/auth/login | public | Get JWT |
| GET | /api/spots/nearby?lat&lng&radius&vehicleType | logged in | Active spots near a point |
| GET | /api/spots/mine | host | Host's spots |
| POST | /api/spots | host | List a spot |
| PATCH | /api/spots/:id/toggle | host | Turn availability on or off |
| POST | /api/bookings | driver | Book a slot (overlap-checked) |
| GET | /api/bookings/mine | driver | Driver's bookings |
| GET | /api/bookings/host | host | Bookings on host's spots |
| POST | /api/bookings/:id/checkin | host | Verify OTP, start parking |
| POST | /api/bookings/:id/checkout | host | End parking, apply overtime |

## Known gaps before production
- Booking overlap check is check-then-insert. Under heavy concurrency use a MongoDB transaction or a unique slot-lock collection.
- No payments yet. Plug in Razorpay Route (split payouts) at booking and checkout.
- Lat/lng is entered manually. Replace with a map picker (Leaflet or Mapbox) on the host form.
- No photos, 360° check-in snapshots, reviews, KYC, cancellations, or refunds yet.
- Add rate limiting, input validation (zod or Joi), and HTTPS.
