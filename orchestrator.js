import { retrieveTitle } from "./steps/retrieveTitle.js";

export async function runOrchestrator(payload) {
  console.log("Orchestrator started", {
    source: payload?.source || "unknown",
    timestamp: new Date().toISOString(),
  });

  const title = await retrieveTitle();

  console.log("Orchestrator received title:", title);

  return { title };
}
