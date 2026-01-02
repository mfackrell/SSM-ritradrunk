import { retrieveTitle } from "./steps/retrieveTitle.js";
import { generateTrailerText } from "./steps/generateTrailerText.js";
import { checkTrailerText } from "./steps/checkTrailerText.js";
import { getStoryTone } from "./steps/storyTone.js";


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

  // 4. Story tone (single word)
  const storyTone = await getStoryTone(title);

  console.log("Orchestrator completed", {
    title,
    finalTrailerText,
    trailerText,
    storyTone,
    timestamp: new Date().toISOString(),
  });

  return {
    status: "completed",
    title,
    finalTrailerText,
    storyTone,
    trailerText
  };
}
