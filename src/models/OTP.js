import mongoose from "mongoose";

const { Schema } = mongoose;

const otpSchema = new Schema(
  {
    phone: { type: String, required: true },
    email: { type: String },
    otp: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    verified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Auto-delete expired OTPs
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OTPModel = mongoose.model("OTP", otpSchema);
