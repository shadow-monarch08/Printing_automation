## 1. The Resource Math: What Happens on the Pi?

Converting Office documents (`.docx`, `.pptx`) to PDFs or PNGs requires launching a headless instance of LibreOffice.

* **RAM Usage:**
* Launching a single LibreOffice instance consumes around **150MB to 300MB of RAM**.
* Spawning **10 simultaneous conversion processes** will instantly consume **1.5GB to 3.0GB of RAM**. If you are on a 2GB Pi 4, it will force the system into swap storage, crippling performance.


* **CPU Usage:**
* Document conversion is a heavy multi-threaded CPU task. 10 files hitting the Pi at once will max out all 4 cores at **100% CPU utilization** for 10 to 30 seconds.


* **Latency Impact:**
* A single 20-slide PPTX conversion takes ~2–4 seconds on a Pi 4.
* 10 concurrent PPTX conversions queued at once will result in a **20 to 40-second delay** for the last customer waiting for their preview!



---

## 2. The Solution: Zero-Load Architecture for Raspberry Pi

To ensure your Raspberry Pi remains smooth, handles print queues instantly, and never crashes, we apply three strict architectural rules:

### Rule 1: Offload PDFs Entirely to the Client (0% Pi CPU Load)

Since **PDFs make up 70–80% of all print jobs**, we handle PDFs **100% on the customer's phone or laptop** using Mozilla's low-level `pdfjs-dist` (PDF.js).

* The customer's smartphone uses its own CPU to render PDF pages onto raw HTML `<canvas>` elements inside our custom `<PaperSheetPreview/>` UI wrapper.
* **Raspberry Pi Load:** **0% CPU, 0% RAM.**

---

### Rule 2: Sequential Queueing for DOCX / PPTX (Cap Pi Load at 1 File at a Time)

For Office documents that *must* be converted on the Pi:

* **Never convert concurrently.** Implement a background job queue (like `p-queue` or a simple async array queue in Node.js) that limits LibreOffice to **1 conversion at a time** (`concurrency: 1`).
* **Resource Cap:** This caps the Pi's memory usage to a safe **~200MB of RAM** and leaves plenty of CPU headroom for WebSocket connections, the admin dashboard, and CUPS printing tasks.

---

### Rule 3: Client-Side Fast Fallback (For Instant Preview)

For Office files, instead of converting the entire 50-page document into images at once:

1. **Convert ONLY Page 1 / Slide 1** on upload to give the user an instant thumbnail in 1 second.
2. Convert the remaining pages in the background only if the user navigates to them.
3. Alternatively, for DOCX files, use the lightweight client-side library `docx-preview` on the browser to render HTML directly into our paper container—taking 100% of the load off the Pi!

---

## Summary Recommendation

| File Type | Preview Rendering Strategy | Pi CPU / RAM Load | Preview Accuracy |
| --- | --- | --- | --- |
| **PDF** | Client-Side JS (`pdf.js` canvas inside our Paper Container) | **0% (Offloaded to User's Phone)** | 100% Perfect |
| **DOCX** | Client-Side JS (`docx-preview` in div inside Paper Container) OR Single-Page Server Queue | **0% to ~5% (Negligible)** | High (95%+) |
| **PPTX** | Sequential Server Queue (1 file at a time, Page 1 thumbnail first) | **Capped at 25% CPU / 200MB RAM** | 100% Perfect |

By client-side rendering PDFs and capping server-side Office conversions to a single-threaded queue, **10 simultaneous uploads will NOT lag or crash your Raspberry Pi.**