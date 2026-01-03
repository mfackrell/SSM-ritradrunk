import express from "express";
import { runOrchestrator } from "./orchestrator.js";
// Retry Build 001

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "ritra-orchestrator",
    timestamp: new Date().toISOString()
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "ritra-orchestrator",
    timestamp: new Date().toISOString()
  });
});

app.post("/run", async (req, res) => {
  console.log("RUN invoked", {
    source: req.body?.source || "unknown",
    timestamp: new Date().toISOString()
  });

  runOrchestrator(req.body).catch(err => {
    console.error("Orchestrator error", err);
  });

  res.status(200).json({
    status: "accepted",
    message: "Run triggered"
  });
});


const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
