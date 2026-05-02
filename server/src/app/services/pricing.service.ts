import fs from "fs/promises";
import path from "path";

const configPath = path.resolve(__dirname, "../../config/pricing.json");

export interface PricingConfig {
  bwPerPage: number;
  colorPerPage: number;
  currency: string;
  duplexDiscount: number;
  bulkThreshold: number;
  bulkDiscount: number;
}

const DEFAULT_CONFIG: PricingConfig = {
  bwPerPage: 2,
  colorPerPage: 10,
  currency: "₹",
  duplexDiscount: 10,
  bulkThreshold: 50,
  bulkDiscount: 15
};

export async function getPricingConfig(): Promise<PricingConfig> {
  try {
    const data = await fs.readFile(configPath, "utf-8");
    return JSON.parse(data) as PricingConfig;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function updatePricingConfig(newConfig: Partial<PricingConfig>): Promise<PricingConfig> {
  const current = await getPricingConfig();
  const updated = { ...current, ...newConfig };
  await fs.writeFile(configPath, JSON.stringify(updated, null, 2), "utf-8");
  return updated;
}

export async function resetPricingConfig(): Promise<PricingConfig> {
  await fs.writeFile(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2), "utf-8");
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
