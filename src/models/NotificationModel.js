import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SkillAcademyUser",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        "course_purchase",
        "course_completed",
        "lesson_available",
        "module_available",
        "certificate_earned",
        "course_update",
        "promotional",
        "system",
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    icon: {
      type: String,
      default: "Bell",
    },
    relatedEntityType: {
      type: String,
      enum: ["course", "module", "lesson", "certificate", null],
      default: null,
    },
    relatedEntityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    actionUrl: {
      type: String,
      default: null,
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    metadata: {
      type: Map,
      of: String,
      default: {},
    },
  },
  {
    timestamps: true,
    indexes: [
      { userId: 1, createdAt: -1 },
      { userId: 1, read: 1 },
    ],
  }
);

// Compound index for efficient queries
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

// Method to mark as read
notificationSchema.methods.markAsRead = function () {
  this.read = true;
  this.readAt = new Date();
  return this.save();
};

// Static method to create notification
notificationSchema.statics.createNotification = async function (userId, data) {
  return this.create({
    userId,
    type: data.type || "system",
    title: data.title,
    message: data.message,
    icon: data.icon || "Bell",
    relatedEntityType: data.relatedEntityType || null,
    relatedEntityId: data.relatedEntityId || null,
    actionUrl: data.actionUrl || null,
    metadata: data.metadata || {},
  });
};

// Static method to get unread count
notificationSchema.statics.getUnreadCount = function (userId) {
  return this.countDocuments({ userId, read: false });
};

// Static method to get recent notifications
notificationSchema.statics.getRecentNotifications = function (
  userId,
  limit = 10
) {
  return this.find({ userId }).sort({ createdAt: -1 }).limit(limit).lean();
};

export default mongoose.model("Notification", notificationSchema);
