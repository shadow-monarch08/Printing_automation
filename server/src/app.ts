import express from "express";
import cors from "cors";
import path from "path";
import printerRoutes from "./routes/printer.routes";
import printRoutes from "./routes/print.routes";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve the admin UI (static files) from the public directory
app.use(express.static(path.join(__dirname, "../public")));

// API routes
app.use("/printers", printerRoutes);
app.use("/print", printRoutes);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// React Catch-all
app.get("*", (_, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

export default app;
