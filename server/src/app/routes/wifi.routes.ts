import { Router } from "express";
import * as wifiController from "../controllers/wifi.controller";

const router = Router();

router.get("/scan", wifiController.scanWifiNetworks);
router.get("/connection-status", wifiController.getWifiConnectionStatus);
router.post("/connect", wifiController.connectWifiNetwork);

export default router;
