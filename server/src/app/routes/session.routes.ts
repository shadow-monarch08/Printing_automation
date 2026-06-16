import { Router } from "express";
import * as sessionController from "../controllers/session.controller";

const router = Router();

router.post("/init", sessionController.initKioskSession);

export default router;
