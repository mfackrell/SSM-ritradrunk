import express from "express";

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

  res.status(200).json({
    status: "accepted",
    message: "Run acknowledged"
  });
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
