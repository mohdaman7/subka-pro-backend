import mongoose from 'mongoose';

const { Schema } = mongoose;

const interviewSchema = new Schema(
  {
    // References
    applicationId: { 
      type: Schema.Types.ObjectId, 
      ref: 'Application', 
      required: true 
    },
    jobId: { 
      type: Schema.Types.ObjectId, 
      ref: 'Job', 
      required: true 
    },
    candidateId: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true 
    },
    employerId: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true 
    },
    
    // Interview Details
    title: { 
      type: String, 
      required: true,
      default: 'Interview' 
    },
    scheduledAt: { 
      type: Date, 
      required: true 
    },
    timezone: { 
      type: String, 
      default: 'UTC' 
    },
    durationMinutes: { 
      type: Number, 
      default: 60,
      min: 15,
      max: 480 
    },
    
    // Interview Type
    type: { 
      type: String, 
      enum: ['video', 'phone', 'onsite', 'technical', 'hr', 'panel'], 
      default: 'video' 
    },
    
    // Location/Meeting Details
    meetingLink: { type: String },
    location: { 
      address: { type: String },
      room: { type: String },
      instructions: { type: String },
    },
    
    // Interviewers/Panel
    interviewers: [{
      userId: { type: Schema.Types.ObjectId, ref: 'User' },
      name: { type: String, required: true },
      email: { type: String, required: true },
      role: { type: String },
      isPrimary: { type: Boolean, default: false },
    }],
    
    // Status Tracking
    status: { 
      type: String, 
      enum: ['scheduled', 'rescheduled', 'in-progress', 'completed', 'cancelled', 'no-show'], 
      default: 'scheduled' 
    },
    
    // Round/Stage
    round: { 
      type: Number, 
      default: 1 
    },
    stage: { 
      type: String, 
      enum: ['screening', 'technical', 'hr', 'final', 'cultural'], 
      default: 'screening' 
    },
    
    // Notes and Instructions
    notes: { type: String },
    instructions: { type: String },
    
    // Evaluation
    evaluation: {
      technicalSkills: { type: Number, min: 0, max: 5 },
      communication: { type: Number, min: 0, max: 5 },
      problemSolving: { type: Number, min: 0, max: 5 },
      culturalFit: { type: Number, min: 0, max: 5 },
      overall: { type: Number, min: 0, max: 5 },
      strengths: [{ type: String }],
      weaknesses: [{ type: String }],
      feedback: { type: String },
      recommendation: { 
        type: String, 
        enum: ['strong-hire', 'hire', 'maybe', 'no-hire', 'pending'] 
      },
    },
    
    // Result
    result: { 
      type: String, 
      enum: ['passed', 'failed', 'next-round', 'pending', 'on-hold'], 
      default: 'pending' 
    },
    
    // Reminders
    reminders: {
      candidateReminded: { type: Boolean, default: false },
      interviewerReminded: { type: Boolean, default: false },
      lastReminderSent: { type: Date },
    },
    
    // History
    history: [{
      action: { 
        type: String, 
        enum: ['scheduled', 'rescheduled', 'cancelled', 'completed', 'no-show', 'feedback-added'] 
      },
      timestamp: { type: Date, default: Date.now },
      performedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      reason: { type: String },
      previousData: { type: Schema.Types.Mixed },
    }],
    
    // Metadata
    createdBy: { 
      type: Schema.Types.ObjectId, 
      ref: 'User' 
    },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
    cancelReason: { type: String },
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes
interviewSchema.index({ candidateId: 1, scheduledAt: -1 });
interviewSchema.index({ employerId: 1, scheduledAt: -1 });
interviewSchema.index({ status: 1, scheduledAt: 1 });
interviewSchema.index({ applicationId: 1 });

// Virtuals
interviewSchema.virtual('isPast').get(function() {
  return this.scheduledAt < new Date();
});

interviewSchema.virtual('isUpcoming').get(function() {
  const now = new Date();
  const interviewTime = new Date(this.scheduledAt);
  return interviewTime > now;
});

interviewSchema.virtual('isToday').get(function() {
  const today = new Date();
  const interviewDate = new Date(this.scheduledAt);
  return today.toDateString() === interviewDate.toDateString();
});

// Methods
interviewSchema.methods.addHistory = function(action, performedBy, reason = '', previousData = null) {
  this.history.push({
    action,
    performedBy,
    reason,
    previousData,
    timestamp: new Date(),
  });
};

interviewSchema.methods.reschedule = function(newTime, reason, performedBy) {
  this.addHistory('rescheduled', performedBy, reason, {
    previousScheduledAt: this.scheduledAt,
  });
  this.scheduledAt = newTime;
  this.status = 'rescheduled';
};

interviewSchema.methods.cancel = function(reason, performedBy) {
  this.addHistory('cancelled', performedBy, reason);
  this.status = 'cancelled';
  this.cancelledAt = new Date();
  this.cancelReason = reason;
};

interviewSchema.methods.complete = function(evaluation, performedBy) {
  this.evaluation = evaluation;
  this.status = 'completed';
  this.completedAt = new Date();
  this.addHistory('completed', performedBy);
};

export const InterviewModel = mongoose.model('Interview', interviewSchema);
