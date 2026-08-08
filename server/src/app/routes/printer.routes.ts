import { Router } from "express";
import * as printerCtrl from "../controllers/printer.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.get("/", asyncHandler(printerCtrl.getPrinters));
router.get("/default", asyncHandler(printerCtrl.getDefaultPrinter));
router.post("/default", asyncHandler(printerCtrl.setDefaultPrinter));
router.put("/:name/alias", asyncHandler(printerCtrl.updateAlias));
router.get("/:name/supplies", asyncHandler(printerCtrl.getSupplies));
router.post("/:name/refresh", asyncHandler(printerCtrl.forceRefreshPrinter));
router.post("/detect", asyncHandler(printerCtrl.detectPrinters));
router.get("/detect-legacy", asyncHandler(printerCtrl.detectLegacyPrinters));
router.post("/configure", asyncHandler(printerCtrl.configurePrinter));
router.put("/:name/capabilities", asyncHandler(printerCtrl.updateCapabilities));
router.delete("/", asyncHandler(requireAuth), asyncHandler(printerCtrl.deleteAllPrinters));
router.delete("/:name", asyncHandler(requireAuth), asyncHandler(printerCtrl.deletePrinter));

export default router;
