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
  res.status(200).send("ok");
});

app.post("/run", async (req, res) => {
  console.log("Run invoked", {
    timestamp: new Date().toISOString()
  });

  res.json({
    status: "accepted",
    message: "Run triggered"
  });
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
