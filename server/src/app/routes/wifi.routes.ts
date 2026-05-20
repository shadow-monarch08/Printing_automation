import { Router } from "express";
import * as wifiController from "../controllers/wifi.controller";

const router = Router();

router.get("/scan", wifiController.scanWifiNetworks);
router.get("/setup-mode", wifiController.getWifiSetupMode);
router.post("/connect", wifiController.connectWifiNetwork);

export default router;
