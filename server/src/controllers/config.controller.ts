import { Request, Response } from "express";
import * as pricingService from "../services/pricing.service";

export async function getPricingConfig(req: Request, res: Response) {
  try {
    const config = await pricingService.getPricingConfig();
    res.json({ success: true, config });
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Failed to get config", error: String(err) });
  }
}

export async function updatePricingConfig(req: Request, res: Response) {
  try {
    const config = await pricingService.updatePricingConfig(req.body);
    res.json({ success: true, config });
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Failed to update config", error: String(err) });
  }
}

export async function resetPricingConfig(req: Request, res: Response) {
  try {
    const config = await pricingService.resetPricingConfig();
    res.json({ success: true, config });
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Failed to reset config", error: String(err) });
  }
}
