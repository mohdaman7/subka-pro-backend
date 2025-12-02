import { Server } from "socket.io";
import Notification from "../models/NotificationModel.js";

// Map to store active user connections
const activeUsers = new Map();

export function initializeSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: [
        "https://sabka-pro-hiring-coral.vercel.app",
        "http://localhost:3000",
      ],
      credentials: true,
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  // Middleware to authenticate socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    const userId = socket.handshake.auth.userId;

    if (!token || !userId) {
      return next(new Error("Authentication error"));
    }

    // Store user connection
    socket.userId = userId;
    socket.token = token;
    next();
  });

  // Handle socket connections
  io.on("connection", (socket) => {
    console.log(
      `✅ User connected: ${socket.userId} (Socket ID: ${socket.id})`
    );

    // Track active user
    if (!activeUsers.has(socket.userId)) {
      activeUsers.set(socket.userId, []);
    }
    activeUsers.get(socket.userId).push(socket.id);

    // Emit user online status
    io.emit("user:online", { userId: socket.userId, socketId: socket.id });

    // Handle joining user room (for direct messages to specific user)
    socket.join(`user:${socket.userId}`);

    // Handle notification events
    socket.on("notification:read", async (data) => {
      try {
        const { notificationId } = data;
        await Notification.findByIdAndUpdate(notificationId, {
          read: true,
          readAt: new Date(),
        });

        // Emit to user that notification was read
        socket.emit("notification:read:success", { notificationId });
      } catch (error) {
        console.error("Error marking notification as read:", error);
        socket.emit("error", {
          message: "Failed to mark notification as read",
        });
      }
    });

    // Handle mark all as read
    socket.on("notification:read-all", async (data) => {
      try {
        const result = await Notification.updateMany(
          { userId: socket.userId, read: false },
          { read: true, readAt: new Date() }
        );

        socket.emit("notification:read-all:success", {
          modifiedCount: result.modifiedCount,
        });
      } catch (error) {
        console.error("Error marking all notifications as read:", error);
        socket.emit("error", { message: "Failed to mark all as read" });
      }
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      console.log(`❌ User disconnected: ${socket.userId}`);

      // Remove user from active connections
      const userSockets = activeUsers.get(socket.userId);
      if (userSockets) {
        const index = userSockets.indexOf(socket.id);
        if (index > -1) {
          userSockets.splice(index, 1);
        }
        if (userSockets.length === 0) {
          activeUsers.delete(socket.userId);
        }
      }

      // Emit user offline status
      io.emit("user:offline", { userId: socket.userId });
    });

    // Handle errors
    socket.on("error", (error) => {
      console.error(`Socket error for user ${socket.userId}:`, error);
    });
  });

  return io;
}

// Helper function to send notification to specific user
export async function sendNotificationToUser(io, userId, notificationData) {
  try {
    // Save notification to database
    const notification = await Notification.createNotification(
      userId,
      notificationData
    );

    // Emit to user's socket room if they're online
    io.to(`user:${userId}`).emit("notification:new", {
      _id: notification._id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      icon: notification.icon,
      read: notification.read,
      createdAt: notification.createdAt,
      actionUrl: notification.actionUrl,
    });

    return notification;
  } catch (error) {
    console.error("Error sending notification:", error);
    throw error;
  }
}

// Helper function to send notification to multiple users
export async function sendNotificationToUsers(io, userIds, notificationData) {
  try {
    const notifications = await Promise.all(
      userIds.map((userId) =>
        Notification.createNotification(userId, notificationData)
      )
    );

    // Emit to each user's room
    userIds.forEach((userId) => {
      io.to(`user:${userId}`).emit("notification:new", {
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
        icon: notificationData.icon || "Bell",
        read: false,
        createdAt: new Date(),
        actionUrl: notificationData.actionUrl,
      });
    });

    return notifications;
  } catch (error) {
    console.error("Error sending notifications to multiple users:", error);
    throw error;
  }
}

// Helper function to send broadcast notification
export async function broadcastNotification(
  io,
  notificationData,
  filter = null
) {
  try {
    // Emit broadcast to all connected users
    if (filter) {
      Object.keys(io.sockets.sockets).forEach((socketId) => {
        const socket = io.sockets.sockets[socketId];
        if (filter(socket.userId)) {
          socket.emit("notification:broadcast", {
            type: notificationData.type,
            title: notificationData.title,
            message: notificationData.message,
            icon: notificationData.icon || "Bell",
          });
        }
      });
    } else {
      io.emit("notification:broadcast", {
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
        icon: notificationData.icon || "Bell",
      });
    }
  } catch (error) {
    console.error("Error broadcasting notification:", error);
    throw error;
  }
}

// Export active users for debugging
export function getActiveUsers() {
  return Object.fromEntries(activeUsers);
}
