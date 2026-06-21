import db from "../../infrastructure/database";
import { globalPricingConfig, setGlobalPricingConfig, PricingConfigRow } from "../../infrastructure/boot";
import { PricingConfig } from "../types";

const DEFAULT_CONFIG: PricingConfig = {
  bwPerPage: 200,
  colorPerPage: 1000,
  currency: "₹",
  duplexDiscount: 0,
  bulkThreshold: 50,
  bulkDiscount: 15
};

export async function getPricingConfig(): Promise<PricingConfig> {
  if (globalPricingConfig) {
    return {
      bwPerPage: globalPricingConfig.base_price_bw,
      colorPerPage: globalPricingConfig.base_price_color,
      currency: DEFAULT_CONFIG.currency,
      duplexDiscount: globalPricingConfig.duplex_discount_percent,
      bulkThreshold: DEFAULT_CONFIG.bulkThreshold,
      bulkDiscount: DEFAULT_CONFIG.bulkDiscount,
    };
  }
  return DEFAULT_CONFIG;
}

export async function updatePricingConfig(newConfig: Partial<PricingConfig>): Promise<PricingConfig> {
  const current = await getPricingConfig();
  const updated = { ...current, ...newConfig };
  
  db.prepare(`
    UPDATE pricing_config 
    SET base_price_bw = ?, base_price_color = ?, duplex_discount_percent = ?, updated_at = datetime('now')
    WHERE id = 1
  `).run(
    updated.bwPerPage,
    updated.colorPerPage,
    updated.duplexDiscount
  );
  
  const newRow = db.prepare("SELECT * FROM pricing_config WHERE id = 1").get() as PricingConfigRow | undefined;
  setGlobalPricingConfig(newRow || null);
  
  return updated;
}

export async function resetPricingConfig(): Promise<PricingConfig> {
  db.prepare(`
    UPDATE pricing_config 
    SET base_price_bw = ?, base_price_color = ?, duplex_discount_percent = ?, updated_at = datetime('now')
    WHERE id = 1
  `).run(
    DEFAULT_CONFIG.bwPerPage,
    DEFAULT_CONFIG.colorPerPage,
    DEFAULT_CONFIG.duplexDiscount
  );

  const newRow = db.prepare("SELECT * FROM pricing_config WHERE id = 1").get() as PricingConfigRow | undefined;
  setGlobalPricingConfig(newRow || null);

  return DEFAULT_CONFIG;
}

export async function calculateQuote(
  pages: number,
  copies: number,
  colorMode: "color" | "grayscale",
  duplex: "single" | "double"
): Promise<{ cost: number; breakdown: any }> {
  const config = await getPricingConfig();
  const totalPages = pages * copies;
  
  let basePricePerSheet = colorMode === "color" ? config.colorPerPage : config.bwPerPage;
  let totalCost = totalPages * basePricePerSheet;

  let duplexDiscountAmt = 0;
  if (duplex === "double") {
    // Duplex discount applies to the total cost
    duplexDiscountAmt = totalCost * (config.duplexDiscount / 100);
    totalCost -= duplexDiscountAmt;
  }

  let bulkDiscountAmt = 0;
  if (totalPages >= config.bulkThreshold) {
    bulkDiscountAmt = totalCost * (config.bulkDiscount / 100);
    totalCost -= bulkDiscountAmt;
  }

  return {
    cost: Math.round(totalCost),
    breakdown: {
      pages,
      copies,
      totalPages,
      basePricePerSheet,
      duplexDiscountAmt: Math.round(duplexDiscountAmt),
      bulkDiscountAmt: Math.round(bulkDiscountAmt),
      currency: config.currency
    }
  };
}
