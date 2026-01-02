import { retrieveTitle } from "./steps/retrieveTitle.js";
import { generateTrailerText } from "./steps/generateTrailerText.js";
import { checkTrailerText } from "./steps/checkTrailerText.js";
import { getStoryTone } from "./steps/storyTone.js";
import { generateAudio } from "./steps/generateAudio.js";
import { generateImagePrompts } from "./steps/generateImagePrompts.js";
import { generateImages } from "./steps/generateImages.js";

export async function runOrchestrator(payload = {}) {
  console.log("Orchestrator started", { timestamp: new Date().toISOString() });

  // --- SERIAL STEPS (Must happen in order) ---
  
  // 1. Title
  const title = await retrieveTitle();
  
  // 2. Text Generation
  const trailerText = await generateTrailerText(title);
  const finalTrailerText = await checkTrailerText(trailerText);

  // 3. Metadata & Prep
  const storyTone = await getStoryTone(title);
  
  // We generate prompts now because it's nearly instant (just text splitting)
  // and we need it ready for the image generator.
  const imagePrompts = await generateImagePrompts(finalTrailerText, 5);

  // --- PARALLEL STEPS (Run Audio & Images at the same time) ---
  console.log("Starting parallel generation: Audio + Images...");

  const [audio, imageUrls] = await Promise.all([
    // Task A: Generate Audio
    generateAudio({ text: finalTrailerText, tone: storyTone }),

    // Task B: Generate Images (Daisy Chain)
    generateImages(imagePrompts)
  ]);

  console.log("Parallel generation complete.");
  console.log("Orchestrator finished successfully.");

  return {
    status: "completed",
    title,
    finalTrailerText,
    storyTone,
    audio,          // Result from Task A
    imagePrompts,   // Result from Prep step
    imageUrls       // Result from Task B
  };
}
