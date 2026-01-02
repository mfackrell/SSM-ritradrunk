import crypto from "crypto";
import { retrieveTitle } from "../steps/retrieveTitle.js";

export async function runOrchestrator(input = {}) {
  const context = {
    runId: crypto.randomUUID(),
    source: input.source || "manual",
    startedAt: new Date().toISOString()
  };

  await retrieveTitle(context);

  console.log("ORCHESTRATION COMPLETE", {
    runId: context.runId
  });

  return context;
}
