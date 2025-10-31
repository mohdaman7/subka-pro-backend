import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.string().optional(),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  CORS_ORIGIN: z.string().optional(),
  SMTP_HOST: z.string().min(1, "SMTP_HOST is required"),
  SMTP_PORT: z.string().min(1, "SMTP_PORT is required"),
  SMTP_SECURE: z.string().default("false"),
  SMTP_USER: z.string().min(1, "SMTP_USER is required"),
  SMTP_PASS: z.string().min(1, "SMTP_PASS is required"),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_LOGIN_EMAIL: z.string().email().optional(),
  ADMIN_LOGIN_PASSWORD: z.string().min(6).optional(),
});

console.log(process.env.MONGODB_URI);

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "Invalid environment variables:",
    parsed.error.flatten().fieldErrors
  );
  process.exit(1);
}

export const env = {
  nodeEnv: parsed.data.NODE_ENV,
  port: Number(parsed.data.PORT ?? 4000),
  mongoUri: parsed.data.MONGODB_URI,
  jwtSecret: parsed.data.JWT_SECRET,
  corsOrigin: parsed.data.CORS_ORIGIN,
  smtpHost: parsed.data.SMTP_HOST,
  smtpPort: Number(parsed.data.SMTP_PORT),
  smtpSecure: parsed.data.SMTP_SECURE,
  smtpUser: parsed.data.SMTP_USER,
  smtpPass: parsed.data.SMTP_PASS,
  adminEmail: parsed.data.ADMIN_EMAIL,
  adminLoginEmail: parsed.data.ADMIN_LOGIN_EMAIL,
  adminLoginPassword: parsed.data.ADMIN_LOGIN_PASSWORD,
};
