import { Router } from "express";
import * as wifiController from "../controllers/wifi.controller";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.get("/scan", asyncHandler(wifiController.scanWifiNetworks));
router.get("/connection-status", asyncHandler(wifiController.getWifiConnectionStatus));
router.post("/connect", asyncHandler(wifiController.connectWifiNetwork));

export default router;
