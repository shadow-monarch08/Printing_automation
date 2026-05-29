import { Router } from "express";
import * as printerCtrl from "../controllers/printer.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", printerCtrl.getPrinters);
router.get("/default", printerCtrl.getDefaultPrinter);
router.post("/default", printerCtrl.setDefaultPrinter);
router.put("/:name/alias", printerCtrl.updateAlias);
router.get("/:name/supplies", printerCtrl.getSupplies);
router.post("/:name/refresh", printerCtrl.forceRefreshPrinter);
router.post("/detect", printerCtrl.detectPrinters);
router.get("/detect-legacy", printerCtrl.detectLegacyPrinters);
router.post("/configure", printerCtrl.configurePrinter);
router.put("/:name/capabilities", printerCtrl.updateCapabilities);
router.delete("/", requireAuth, printerCtrl.deleteAllPrinters);
router.delete("/:name", requireAuth, printerCtrl.deletePrinter);


export default router;
