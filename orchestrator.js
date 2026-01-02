import { retrieveTitle } from "./steps/retrieveTitle.js";
import { generateTrailerText } from "./steps/generateTrailerText.js";
import { checkTrailerText } from "./steps/checkTrailerText.js";

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

  // 3. Check/Rephrase Text (Zap Step 4)
  const finalTrailerText = await checkTrailerText(trailerText);

  console.log("Orchestrator completed", {
    title,
    finalTrailerText,
    trailerText,
    timestamp: new Date().toISOString(),
  });

  return {
    status: "completed",
    title,
    trailerText
  };
}
