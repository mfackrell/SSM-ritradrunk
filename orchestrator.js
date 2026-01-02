import { retrieveTitle } from "./steps/retrieveTitle.js";

export async function runOrchestrator(payload = {}) {
  const context = {
    source: payload.source || "unknown",
    startedAt: new Date().toISOString()
  };

  console.log("Orchestrator started", context);

  // STEP 1 — Retrieve Title (Zap Step #2 equivalent)
  const title = await retrieveTitle();

  console.log("Retrieved title", { title });

  return {
    status: "completed",
    title
  };
}
