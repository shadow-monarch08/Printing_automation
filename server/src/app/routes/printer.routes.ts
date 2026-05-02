import { Router } from "express";
import * as printerCtrl from "../controllers/printer.controller";

const router = Router();

router.get("/", printerCtrl.getPrinters);
router.get("/default", printerCtrl.getDefaultPrinter);
router.post("/default", printerCtrl.setDefaultPrinter);
router.put("/:name/alias", printerCtrl.updateAlias);
router.get("/:name/supplies", printerCtrl.getSupplies);
router.post("/detect", printerCtrl.detectPrinters);
router.get("/detect-legacy", printerCtrl.detectLegacyPrinters);
router.post("/configure", printerCtrl.configurePrinter);

export default router;
