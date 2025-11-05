import mongoose from 'mongoose';

const { Schema } = mongoose;

const applicationSchema = new Schema(
  {
    jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    employerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    resumeUrl: { type: String },
    // Optional metadata fields from application form
    meta: {
      previousCompany: { type: String },
      previousPosition: { type: String },
      yearsExperience: { type: Schema.Types.Mixed },
      languages: { type: String },
    },
    // HR Assignment and tracking
    assignedHR: { 
      type: Schema.Types.ObjectId, 
      ref: 'User',
      default: null 
    },
    assignedAt: { type: Date },
    // Application rating and evaluation
    rating: {
      overall: { type: Number, min: 0, max: 5, default: 0 },
      skills: { type: Number, min: 0, max: 5, default: 0 },
      experience: { type: Number, min: 0, max: 5, default: 0 },
      culture: { type: Number, min: 0, max: 5, default: 0 },
    },
    // Internal notes for HR team
    notes: [{
      content: { type: String, required: true },
      createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
      createdAt: { type: Date, default: Date.now },
      isInternal: { type: Boolean, default: true },
    }],
    // Interview scheduling information
    interview: {
      type: new Schema(
        {
          scheduledAt: { type: Date },
          timezone: { type: String },
          durationMinutes: { type: Number },
          type: { type: String, enum: ['video', 'phone', 'onsite'] },
          meetingLink: { type: String },
          location: { type: String },
          panel: [
            new Schema(
              {
                name: { type: String },
                email: { type: String },
                role: { type: String },
              },
              { _id: false }
            ),
          ],
          notes: { type: String },
          status: {
            type: String,
            enum: ['scheduled', 'rescheduled', 'completed', 'cancelled', 'no-show'],
          },
          feedback: { type: String },
          technicalRating: { type: Number, min: 0, max: 5 },
          communicationRating: { type: Number, min: 0, max: 5 },
          overallRating: { type: Number, min: 0, max: 5 },
          result: { type: String, enum: ['passed', 'failed', 'next-round', 'pending'] },
          history: [
            new Schema(
              {
                scheduledAt: { type: Date },
                updatedAt: { type: Date, default: Date.now },
                reason: { type: String },
              },
              { _id: false }
            ),
          ],
        },
        { _id: false }
      ),
      default: null,
    },
    status: {
      type: String,
      enum: ['applied', 'reviewed', 'shortlisted', 'interview', 'rejected', 'hired', 'withdrawn'],
      default: 'applied',
      required: true,
    },
    // Status history tracking
    statusHistory: [{
      status: { type: String },
      updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      updatedAt: { type: Date, default: Date.now },
      reason: { type: String },
    }],
    // Communication logs
    communications: [{
      type: { type: String, enum: ['email', 'sms', 'whatsapp', 'call'] },
      content: { type: String },
      sentAt: { type: Date, default: Date.now },
      sentBy: { type: Schema.Types.ObjectId, ref: 'User' },
      status: { type: String, enum: ['sent', 'delivered', 'failed'] },
    }],
    // Source tracking
    source: { 
      type: String, 
      enum: ['web', 'app', 'admin', 'referral', 'direct'], 
      default: 'web' 
    },
    // Rejection reason (if rejected)
    rejectionReason: { type: String },
    rejectedAt: { type: Date },
    rejectedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Indexes for better query performance
applicationSchema.index({ jobId: 1, studentId: 1 }, { unique: true });
applicationSchema.index({ status: 1, createdAt: -1 });
applicationSchema.index({ assignedHR: 1 });
applicationSchema.index({ employerId: 1 });

// Virtual for time to hire
applicationSchema.virtual('timeToHire').get(function() {
  if (this.status === 'hired' && this.createdAt) {
    return Math.floor((this.updatedAt - this.createdAt) / (1000 * 60 * 60 * 24)); // days
  }
  return null;
});

export const ApplicationModel = mongoose.model('Application', applicationSchema);
