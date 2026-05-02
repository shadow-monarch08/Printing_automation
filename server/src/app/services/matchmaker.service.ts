import * as printerService from "./printer.service";
import { PrintJobData } from "../../infrastructure/printMaster.queue";

export async function findPrinter(jobData: PrintJobData): Promise<string | null> {
  const printers = await printerService.listPrinters();
  
  // 1. Filter to idle printers
  let candidates = printers.filter(p => p.status === "idle");
  
  // 2. Exclude attempted/failed printers
  if (jobData.attemptedPrinters && jobData.attemptedPrinters.length > 0) {
    candidates = candidates.filter(p => !jobData.attemptedPrinters.includes(p.name));
  }
  
  // 3. Match capabilities
  candidates = candidates.filter(p => {
    const caps = p.capabilities || [];
    
    // Check color requirements
    if (jobData.colorMode === "color" && !caps.includes("color")) return false;
    
    // Check duplex requirements (if job wants double, printer must support it)
    if (jobData.duplex === "double" && !caps.includes("duplex")) return false;
    
    // If we only need single sided or bw, practically all printers support it 
    // unless they strictly define otherwise, but usually we just assume yes.
    
    return true;
  });

  if (candidates.length === 0) {
    return null;
  }

  // 4. If target printer is specified and it's in candidates, use it
  if (jobData.targetPrinter) {
    const target = candidates.find(p => p.name === jobData.targetPrinter || p.alias === jobData.targetPrinter);
    if (target) {
      return target.name;
    }
  }

  // 5. Otherwise, pick the first available
  return candidates[0].name;
}
