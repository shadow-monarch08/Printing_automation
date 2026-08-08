import { Router } from "express";
import multer from "multer";
import path from "path";
import * as printController from "../controllers/print.controller";
import { requireValidSession } from "../middlewares/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const upload = multer({
  dest: path.join(__dirname, "../../../uploads"),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max
});

const router = Router();

router.post("/", asyncHandler(requireValidSession), upload.single("file"), asyncHandler(printController.printFile));
router.post("/quote", asyncHandler(requireValidSession), asyncHandler(printController.calculateQuote));

export default router;
