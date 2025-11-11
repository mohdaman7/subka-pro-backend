import express from "express";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import { env } from "./config/env.js";
import { connectToDatabase } from "./config/db.js";
import { errorHandler } from "./middleware/error.js";
import { notFound } from "./middleware/notFound.js";
import authRoutes from "./routes/auth.js";
import jobRoutes from "./routes/jobs.js";
import applicationRoutes from "./routes/applications.js";
import crmRoutes from "./routes/crm.js";
import atsRoutes from "./routes/ats.js";
import leadRoutes from "./routes/leads.js";
import studentRoutes from "./routes/student.js";
import employerRoutes from "./routes/employer.js";
import userRoutes from "./routes/user.js";
import courseRoutes from "./routes/courses.js";
import purchaseRoutes from "./routes/purchases.js";
import resumeRoutes from "./routes/resume.js";
import atsManagementRoutes from "./routes/atsManagement.js";
import analyticsRoutes from "./routes/analytics.js";
import enrollmentRoutes from "./routes/enrollment.js";

// Rate limiting configuration
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100, // limit each IP to 100 requests per windowMs
//   message: {
//     success: false,
//     message: "Too many requests from this IP, please try again later.",
//   },
//   standardHeaders: true,
//   legacyHeaders: false,
// });

// More strict rate limiting for auth endpoints
// const authLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 5, // limit each IP to 5 requests per windowMs for auth
//   message: {
//     success: false,
//     message: "Too many authentication attempts, please try again later.",
//   },
//   standardHeaders: true,
//   legacyHeaders: false,
// });

async function bootstrap() {
  try {
    console.log("🚀 Starting server initialization...");
    console.log("📦 Connecting to MongoDB...");

    await connectToDatabase(env.mongoUri);
    console.log("✅ Connected to MongoDB successfully!");

    const app = express();

    // Security middleware
    app.use(
      helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" },
      })
    );

    // CORS configuration
    app.use(
      cors({
        origin: [
          "https://sabka-pro-hiring-coral.vercel.app", // your live frontend
          "http://localhost:3000", // for local testing
        ],
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
      })
    );

    // Static and body parsing middleware
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const uploadsDir = path.resolve(__dirname, "..", "uploads");
    app.use("/uploads", express.static(uploadsDir));
    app.use(express.json({ limit: "10mb" }));
    app.use(express.urlencoded({ extended: true, limit: "10mb" }));

    // Logging
    if (env.nodeEnv === "development") {
      app.use(morgan("dev"));
    } else {
      app.use(morgan("combined"));
    }

    // Apply rate limiting to all routes
    // app.use(limiter);

    // Health check endpoint
    app.get("/health", (_req, res) => {
      res.status(200).json({
        success: true,
        message: "Server is running healthy!",
        timestamp: new Date().toISOString(),
        environment: env.nodeEnv,
      });
    });

    // API status endpoint
    app.get("/", (_req, res) => {
      res.json({
        success: true,
        message: "🎯 Job Board API is running!",
        version: "1.0.0",
        environment: env.nodeEnv,
        timestamp: new Date().toISOString(),
        documentation: "/api/docs", // You can add API documentation later
      });
    });

    // API routes with rate limiting for auth
    app.use("/api/auth", authRoutes);
    app.use("/api/jobs", jobRoutes);
    app.use("/api/applications", applicationRoutes);
    app.use("/api/admin", crmRoutes); // Changed from /api/crm to /api/admin for better semantics
    app.use("/api/admin/ats", atsRoutes); // Legacy ATS routes
    app.use("/api/ats-management", atsManagementRoutes); // New ATS Management System
    app.use("/api/leads", leadRoutes);
    app.use("/api/student", studentRoutes);
    app.use("/api/courses", courseRoutes);
    app.use("/api/purchases", purchaseRoutes);
    app.use("/api/employer", employerRoutes);
    app.use("/api/user", userRoutes);
    app.use("/api/resume", resumeRoutes);
    app.use("/api/analytics", analyticsRoutes);
    app.use("/api/enrollments", enrollmentRoutes);

    // API documentation route (you can implement Swagger later)
    app.get("/api/docs", (_req, res) => {
      res.json({
        success: true,
        message: "API Documentation",
        endpoints: {
          auth: "/api/auth",
          jobs: "/api/jobs",
          applications: "/api/applications",
          admin: "/api/admin",
          leads: "/api/leads",
          student: "/api/student",
          courses: "/api/courses",
          purchases: "/api/purchases",
          employer: "/api/employer",
          user: "/api/user",
          resume: "/api/resume",
        },
      });
    });

    // Handle preflight requests
    app.options("*", cors());

    // 404 handler for undefined routes
    app.use(notFound);

    // Global error handler (should be last)
    app.use(errorHandler);

    // Graceful shutdown handling
    process.on("SIGTERM", () => {
      console.log("SIGTERM received, shutting down gracefully");
      process.exit(0);
    });

    process.on("SIGINT", () => {
      console.log("SIGINT received, shutting down gracefully");
      process.exit(0);
    });

    const PORT = process.env.PORT || env.port || 4000;

    const server = app.listen(PORT, () => {
      console.log(`🎉 Server started successfully!`);
      console.log(`📍 Environment: ${env.nodeEnv}`);
      console.log(`🚀 API listening on http://localhost:${PORT}`);
      console.log(`📚 API Documentation: http://localhost:${PORT}/api/docs`);
      console.log(`❤️  Health check: http://localhost:${PORT}/health`);
    });

    // Handle server errors
    server.on("error", (error) => {
      console.error("❌ Server error:", error);
      process.exit(1);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

// Start the application
bootstrap();
