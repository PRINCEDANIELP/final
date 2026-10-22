import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema(
  {
    spot: { type: mongoose.Schema.Types.Mixed, ref: 'ParkingSpot', required: true, index: true },
    driver: { type: mongoose.Schema.Types.Mixed, ref: 'User', required: true, index: true },
    host: { type: mongoose.Schema.Types.Mixed, ref: 'User', index: true },
    vehicleNumber: { type: String, required: true, uppercase: true, trim: true },
    driverName: { type: String, trim: true },
    driverPhone: { type: String, trim: true },
    aadhaarNumber: { type: String, trim: true, default: '' },
    aadhaarPhotoUrl: { type: String, default: '' },
    licenceName: { type: String, trim: true, default: '' },
    licenceNumber: { type: String, trim: true, default: '' },
    licencePhotoUrl: { type: String, default: '' },
    isKycVerified: { type: Boolean, default: false },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    status: {
      type: String,
      enum: ['CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED'],
      default: 'CONFIRMED',
    },
    otp: { type: String, required: true },
    totalAmount: { type: Number, default: 0 },
    checkedInAt: Date,
    checkedOutAt: Date,
  },
  { timestamps: true }
);

export default mongoose.model('Booking', bookingSchema);
