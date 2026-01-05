import { retrieveTitle } from "./steps/retrieveTitle.js";
import { generateTrailerText } from "./steps/generateTrailerText.js";
import { checkTrailerText } from "./steps/checkTrailerText.js";
import { getStoryTone } from "./steps/storyTone.js";
import { extractBookMetadata } from "./steps/extractBookMetadata.js"; // Added
import { fetchBookDetails } from "./steps/fetchBookDetails.js"; // <--- NEW IMPORT
import { generateAudio } from "./steps/generateAudio.js";
import { generateImagePrompts } from "./steps/generateImagePrompts.js";
import { generateImages } from "./steps/generateImages.js";
import { requestVideoRender } from "./steps/requestVideoRender.js";
import { generateDescription } from "./steps/generateDescription.js"; // <--- Import
import { triggerZapier } from "./steps/triggerZapier.js"; // <--- NEW IMPORT
import { deleteProcessedRow } from "./steps/deleteProcessedRow.js"; // <--- NEW IMPORT

export async function runOrchestrator(payload = {}) {
  console.log("Orchestrator started", { timestamp: new Date().toISOString() });

  // --- SERIAL STEPS (Must happen in order) ---
  
  // 1. Title
  const title = await retrieveTitle();
  
  // 2. PARALLEL: Text Generation, Tone Analysis, AND Book Metadata
  console.log("Starting parallel generation: Text + Tone + Metadata...");

  const [finalTrailerText, storyTone, bookMetadata] = await Promise.all([
    // Task A: Generate & Check Text
    generateTrailerText(title).then(text => checkTrailerText(text)),
    
    // Task B: Get Story Tone (Restored)
    getStoryTone(title),

    // Task C: Extract Title/Author via GPT-4o (New)
    extractBookMetadata(title)   
  ]);

  console.log("Parallel generation complete.");
  
  // We generate prompts now because it's nearly instant (just text splitting)
  // and we need it ready for the image generator.
  const imagePrompts = await generateImagePrompts(finalTrailerText, 5);

  // --- PARALLEL STEPS (Run Audio & Images at the same time) ---
  console.log("Starting parallel generation: Audio + Images + Book Details...");

  const [audio, imageUrls, bookDetails, youtubeData] = await Promise.all([
    // Task A: Generate Audio
    generateAudio({ text: finalTrailerText, tone: storyTone }),

    // Task B: Generate Images (Daisy Chain)
    generateImages(imagePrompts),

    // Task C: Fetch Book Details (Now running concurrently)
    fetchBookDetails(bookMetadata),

    // Task D: Generate YouTube Metadata
    generateDescription(finalTrailerText)
  ]);

  console.log("Parallel generation complete.");

  // Send Render Request
// Send Render Request
  let renderResult = null;
  
  // Verify we have assets before calling the renderer
  if (audio?.fileUrl && imageUrls && Object.keys(imageUrls).length > 0) {
    try {
      // We pass the whole audioResult object; the step will extract .fileUrl
      renderResult = await requestVideoRender(audio, imageUrls);

      // --- NEW: ZAPIER HANDOFF ---
      // Only fire if we got a valid URL back from the renderer
      if (renderResult?.url) {
        await triggerZapier({
          title: youtubeData?.title || title,       // Prefer generated title, fallback to raw
          description: youtubeData?.description || "",
          videoUrl: renderResult.url,               // The full MP4 path
          tags: youtubeData?.keywords || []
        });
        await deleteProcessedRow();
      }

    } catch (e) {
      console.error("Video Render or Zapier handoff failed.");
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
    bookMetadata,
    bookDetails,
    youtubeTitle: youtubeData?.title || null,
    youtubeDescription: youtubeData?.description || null,
    youtubeKeywords: youtubeData?.keywords || [],
    audio,    
    imagePrompts,
    renderResult,
    imageUrls    
  };
}
