// ✅ KEEP your existing step import
import { retrieveTitle } from "./steps/retrieveTitle.js";
// ✅ ADD the new step import
import { generateTrailerText } from "./steps/generateTrailerText.js";

export async function runOrchestrator(payload = {}) {
  console.log("Orchestrator started", {
    source: payload.source || "unknown",
    timestamp: new Date().toISOString(),
  });

  // --- Step 1: Retrieve Title (Existing & Working) ---
  const title = await retrieveTitle();
  
  // --- Step 2: Generate Trailer Text (New) ---
  // Pass the title we just got into the next function
  const trailerText = await generateTrailerText(title);

  console.log("Orchestrator completed", {
    title,
    trailerText,
    timestamp: new Date().toISOString(),
  });

  return {
    status: "completed",
    title,
    trailerText
  };
}
