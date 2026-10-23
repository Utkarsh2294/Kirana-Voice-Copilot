import mongoose from 'mongoose';
import { uiLanguageCodes } from '@kirana/shared/languages';

const { Schema } = mongoose;
const embedded = { _id: false, strict: 'throw' };
const merchant = new Schema(
  {
    phone: { type: String, required: true, match: /^\+[1-9]\d{7,14}$/ },
    storeName: String,
    ownerName: String,
    uiLanguage: { type: String, enum: uiLanguageCodes, default: 'en-IN' },
    voiceLanguage: { type: String, enum: uiLanguageCodes, default: 'hi-IN' },
    voicePreference: { type: String, enum: ['male', 'female'], default: 'female' },
    location: new Schema(
      {
        pincode: String,
        district: String,
        state: String,
        regionId: String,
        coarseLat: Number,
        coarseLng: Number,
      },
      embedded,
    ),
    upi: new Schema({ vpa: String, displayName: String, qrImageDataUrl: String }, embedded),
    settings: {
      type: new Schema(
        {
          roundingMode: { type: String, enum: ['none', 'nearest-rupee'], default: 'none' },
          announcePaymentOnWeb: { type: Boolean, default: false },
          readbackMode: { type: String, enum: ['silent', 'verbose'], default: 'silent' },
          haptics: { type: Boolean, default: false },
          earcons: { type: Boolean, default: false },
          theme: { type: String, enum: ['auto', 'dark', 'day'], default: 'dark' },
          targetMarginBps: { type: Number, min: 0, max: 10000, default: 800 },
          closingHour: { type: Number, min: 0, max: 23, default: 0 },
          restockReviewDays: { type: Number, default: 4 },
          supplierLeadDays: { type: Number, default: 1 },
        },
        embedded,
      ),
      default: () => ({}),
    },
    onboardingStep: { type: Number, min: 0, max: 4, default: 0 },
    status: { type: String, enum: ['onboarding', 'active', 'suspended'], default: 'onboarding' },
  },
  { timestamps: true, strict: 'throw' },
);
merchant.index({ phone: 1 }, { unique: true });

const otp = new Schema(
  {
    phone: String,
    codeHash: String,
    expiresAt: Date,
    attempts: { type: Number, default: 0 },
    ip: String,
    usedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
otp.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otp.index({ phone: 1, createdAt: -1 });
const refresh = new Schema(
  {
    merchantId: { type: Schema.Types.ObjectId, required: true },
    tokenHash: String,
    family: String,
    expiresAt: Date,
    replacedBy: { type: String, default: null },
    userAgent: String,
    ip: String,
  },
  { timestamps: true },
);
refresh.index({ tokenHash: 1 }, { unique: true });
refresh.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refresh.index({ family: 1 });
refresh.index({ merchantId: 1 });
const audit = new Schema(
  {
    merchantId: Schema.Types.ObjectId,
    action: String,
    meta: { type: Schema.Types.Mixed, default: () => ({}) },
    ip: String,
    requestId: String,
    at: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
audit.index({ merchantId: 1, at: -1 });
const bucket = new Schema(
  { _id: String, events: [Date], allowed: Boolean, expiresAt: Date },
  { timestamps: true },
);
bucket.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Merchant = mongoose.model('Merchant', merchant, 'merchants');
export const OtpRequest = mongoose.model('OtpRequest', otp, 'otpRequests');
export const RefreshToken = mongoose.model('RefreshToken', refresh, 'refreshTokens');
export const AuditLog = mongoose.model('AuditLog', audit, 'auditLogs');
export const AuthRateBucket = mongoose.model('AuthRateBucket', bucket, 'authRateBuckets');
export async function ensureCoreIndexes() {
  await Promise.all(
    [Merchant, OtpRequest, RefreshToken, AuditLog, AuthRateBucket].map((model) => model.init()),
  );
}
