import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { purchaseController } from "../controllers/purchaseController.js";

const router = Router();

router.use(authenticate);

router.post("/", purchaseController.createPurchase);
router.get("/", purchaseController.listMyPurchases);
router.get("/:id/invoice", purchaseController.getInvoice);

export default router;
