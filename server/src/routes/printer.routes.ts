import { Router } from "express";
import * as printerCtrl from "../controllers/printer.controller";

const router = Router();

router.get("/", printerCtrl.getPrinters);
router.get("/default", printerCtrl.getDefaultPrinter);
router.post("/default", printerCtrl.setDefaultPrinter);

export default router;
