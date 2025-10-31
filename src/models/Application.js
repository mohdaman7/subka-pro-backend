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
            enum: ['scheduled', 'rescheduled', 'completed', 'cancelled'],
          },
          feedback: { type: String },
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
      enum: ['applied', 'reviewed', 'interview', 'rejected', 'hired', 'withdrawn'],
      default: 'applied',
      required: true,
    },
  },
  { timestamps: true }
);

export const ApplicationModel = mongoose.model('Application', applicationSchema);
