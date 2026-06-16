import { Router } from "express";
import multer from "multer";
import path from "path";
import * as printController from "../controllers/print.controller";
import { requireValidSession } from "../middlewares/auth.middleware";

const upload = multer({
  dest: path.join(__dirname, "../../../uploads"),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max
});

const router = Router();

router.post("/", requireValidSession, upload.single("file"), printController.printFile);
router.post("/quote", requireValidSession, printController.calculateQuote);

export default router;
