import { Router } from "express";
import * as printerCtrl from "../controllers/printer.controller";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.get("/kiosk-status", asyncHandler(printerCtrl.getKioskStatus));

export default router;
