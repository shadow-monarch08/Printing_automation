import { Router } from "express";
import * as printerCtrl from "../controllers/printer.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

// Public / Kiosk-facing read endpoints
router.get("/", asyncHandler(printerCtrl.getPrinters));
router.get("/default", asyncHandler(printerCtrl.getDefaultPrinter));
router.get("/:name/supplies", asyncHandler(printerCtrl.getSupplies));

// Admin-protected printer management endpoints
router.post("/default", asyncHandler(requireAuth), asyncHandler(printerCtrl.setDefaultPrinter));
router.put("/:name/alias", asyncHandler(requireAuth), asyncHandler(printerCtrl.updateAlias));
router.post("/:name/refresh", asyncHandler(requireAuth), asyncHandler(printerCtrl.forceRefreshPrinter));
router.post("/detect", asyncHandler(requireAuth), asyncHandler(printerCtrl.detectPrinters));
router.get("/detect-legacy", asyncHandler(requireAuth), asyncHandler(printerCtrl.detectLegacyPrinters));
router.post("/configure", asyncHandler(requireAuth), asyncHandler(printerCtrl.configurePrinter));
router.put("/:name/capabilities", asyncHandler(requireAuth), asyncHandler(printerCtrl.updateCapabilities));
router.delete("/", asyncHandler(requireAuth), asyncHandler(printerCtrl.deleteAllPrinters));
router.delete("/:name", asyncHandler(requireAuth), asyncHandler(printerCtrl.deletePrinter));

export default router;
