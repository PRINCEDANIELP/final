import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['driver', 'host'], default: 'driver' },
    phone: { type: String, default: '' },
    aadhaarNumber: { type: String, default: '' },
    aadhaarPhotoUrl: { type: String, default: '' },
    licenceName: { type: String, default: '' },
    licenceNumber: { type: String, default: '' },
    licencePhotoUrl: { type: String, default: '' },
    isVerified: { type: Boolean, default: false },
    city: { type: String, default: '' },
    address: { type: String, default: '' },
    vehicleNumber: { type: String, default: '' },
    firebaseUid: { type: String, default: '' },
    photoUrl: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
