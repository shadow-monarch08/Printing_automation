import { Router } from "express";
import multer from "multer";
import path from "path";
import * as printController from "../controllers/print.controller";

const upload = multer({
  dest: path.join(__dirname, "../../../uploads"),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max
});

const router = Router();

router.post("/", upload.single("file"), printController.printFile);
router.post("/quote", printController.calculateQuote);

export default router;
