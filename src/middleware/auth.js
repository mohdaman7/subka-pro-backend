import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { UserModel } from "../models/User.js";
import { SkillAcademyUserModel } from "../models/SkillAcademyUser.js";

// ✅ Authenticate Middleware
export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ success: false, message: "Missing or invalid token" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, env.jwtSecret);

    // Handle admin token
    if (decoded.id === "admin" && decoded.role === "admin") {
      req.user = { id: "admin", role: "admin", email: decoded.email };
      return next();
    }

    // Handle skill academy user token
    if (decoded.type === "skill-academy") {
      const skillAcademyUser = await SkillAcademyUserModel.findById(
        decoded.id
      ).select("-passwordHash");
      if (!skillAcademyUser) {
        return res
          .status(401)
          .json({ success: false, message: "User not found" });
      }

      req.user = {
        id: skillAcademyUser._id.toString(),
        type: "skill-academy",
        email: skillAcademyUser.email,
      };
      return next();
    }

    // Handle regular user token
    const user = await UserModel.findById(decoded.id).select("-passwordHash");
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "User not found" });
    }

    req.user = { id: user._id.toString(), role: user.role };
    next();
  } catch (err) {
    console.error("❌ Authentication error:", err.message);
    res.status(401).json({ success: false, message: "Unauthorized" });
  }
}

// ✅ Authorize Middleware
export function authorize(roles = []) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    next();
  };
}

// ✅ Optional authentication: attach req.user if token is valid; otherwise continue
export async function maybeAuthenticate(req, _res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next();
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, env.jwtSecret);

    // Handle skill academy user token
    if (decoded.type === "skill-academy") {
      const skillAcademyUser = await SkillAcademyUserModel.findById(
        decoded.id
      ).select("-passwordHash");
      if (skillAcademyUser) {
        req.user = {
          id: skillAcademyUser._id.toString(),
          type: "skill-academy",
          email: skillAcademyUser.email,
        };
      }
      return next();
    }

    // Handle regular user token
    const user = await UserModel.findById(decoded.id).select("-passwordHash");
    if (user) {
      req.user = { id: user._id.toString(), role: user.role };
    }
    return next();
  } catch (_err) {
    // Ignore invalid token and proceed as anonymous
    return next();
  }
}
