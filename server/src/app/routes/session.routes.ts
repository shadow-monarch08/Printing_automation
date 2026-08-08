import { Router } from "express";
import * as sessionController from "../controllers/session.controller";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.post("/init", asyncHandler(sessionController.initKioskSession));

export default router;
