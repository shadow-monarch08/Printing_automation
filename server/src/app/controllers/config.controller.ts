import { Request, Response } from "express";
import * as pricingService from "../services/pricing.service";
import * as configDbService from "../services/config.db.service";

export async function getPricingConfig(_req: Request, res: Response) {
  const config = await pricingService.getPricingConfig();
  res.json({ success: true, config });
}

export async function updatePricingConfig(req: Request, res: Response) {
  const config = await pricingService.updatePricingConfig(req.body);
  res.json({ success: true, config });
}

export async function resetPricingConfig(_req: Request, res: Response) {
  const config = await pricingService.resetPricingConfig();
  res.json({ success: true, config });
}

export async function getSystemConfig(_req: Request, res: Response) {
  const config = configDbService.getSystemConfig();
  res.json({ success: true, config });
}

export async function updateSystemConfig(req: Request, res: Response) {
  const config = configDbService.updateSystemConfig(req.body);
  res.json({ success: true, config });
}
