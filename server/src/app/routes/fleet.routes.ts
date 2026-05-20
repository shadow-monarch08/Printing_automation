import { Router } from "express";
import * as printerCtrl from "../controllers/printer.controller";

const router = Router();

router.get("/kiosk-status", printerCtrl.getKioskStatus);

export default router;
