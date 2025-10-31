// backend/src/routes/user.js
import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { authenticate } from "../middleware/auth.js";
import { getProfile, updateProfile, changePassword, uploadProfilePicture, uploadResume } from "../controllers/userController.js";

const router = Router();

// Configure multer storage in /uploads
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.resolve(__dirname, "..", "..", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    cb(null, `${unique}-${safeOriginal}`);
  },
});
const upload = multer({ storage });

router.use(authenticate);

router.get("/profile", getProfile);
router.put("/profile", updateProfile);
router.put("/change-password", changePassword);
router.post("/upload-profile-picture", upload.single("profilePicture"), uploadProfilePicture);
router.post("/upload-resume", upload.single("resume"), uploadResume);

export default router;
