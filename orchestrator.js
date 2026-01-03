import { retrieveTitle } from "./steps/retrieveTitle.js";
import { generateTrailerText } from "./steps/generateTrailerText.js";
import { checkTrailerText } from "./steps/checkTrailerText.js";
import { getStoryTone } from "./steps/storyTone.js";
import { generateAudio } from "./steps/generateAudio.js";
import { generateImagePrompts } from "./steps/generateImagePrompts.js";
import { generateImages } from "./steps/generateImages.js";
import { requestVideoRender } from "./steps/requestVideoRender.js";

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

  // Send Render Request
  let renderResult = null;
  
  // Verify we have assets before calling the renderer
  if (audioResult?.fileUrl && imageUrls && Object.keys(imageUrls).length > 0) {
    try {
      // We pass the whole audioResult object; the step will extract .fileUrl
      renderResult = await requestVideoRender(audioResult, imageUrls);
    } catch (e) {
      console.error("Video Render failed, but assets were created.");
      renderResult = { error: e.message };
    }
  } else {
    console.warn("Skipping video render: Missing audio or images.");
  }
  
  console.log("Orchestrator finished successfully.");

  return {
    status: "completed",
    title,
    finalTrailerText,
    storyTone,
    audio, audioResult      
    imagePrompts,
    renderResult,
    imageUrls    
  };
}
