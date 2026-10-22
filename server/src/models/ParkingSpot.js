import mongoose from 'mongoose';

const spotSchema = new mongoose.Schema(
  {
    host: { type: mongoose.Schema.Types.Mixed, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    // GeoJSON point, coordinates are [lng, lat]
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true },
    },
    vehicleTypes: { type: [String], enum: ['BIKE', 'HATCHBACK', 'SEDAN', 'SUV'] },
    hourlyRate: { type: Number, required: true, min: 0 },
    photoUrl: { type: String },
    photos: { type: [String], default: [] },
    amenities: { type: [String] },
    contactPhone: { type: String, trim: true },
    contactName: { type: String, trim: true },
    instructions: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

spotSchema.index({ location: '2dsphere' });

export default mongoose.model('ParkingSpot', spotSchema);
