// steps/requestVideoRender.js

export async function requestVideoRender(audioData, imageMap) {
  console.log("Initiating Video Render Request...");

  // 1. Extract the Audio URL
  // generateAudio returns an object { fileUrl: "...", ... }
  const audioUrl = audioData?.fileUrl;

  if (!audioUrl) {
    throw new Error("No audio URL found in audio data.");
  }

  // 2. Convert the imageMap (Object) to the Array format your Renderer expects
  // We sort by number to ensure section_1 comes before section_2
  const sortedImages = Object.keys(imageMap)
    .sort((a, b) => {
      // Extract number from "section_1", "section_10", etc.
      const numA = parseInt(a.split('_')[1]);
      const numB = parseInt(b.split('_')[1]);
      return numA - numB;
    })
    .map(key => imageMap[key])
    .filter(url => url !== null); // Remove failed generations

  // 3. Prepare Payload (Matches your Zapier screenshot)
  const payload = {
    audio: audioUrl,
    images: sortedImages
  };

  console.log("Sending Payload to Renderer:", JSON.stringify(payload, null, 2));

  // 4. Send POST Request to your specific Service URL
  const RENDER_SERVICE_URL = "https://ffmpeg-test-710616455963.us-central1.run.app";

  try {
    const response = await fetch(RENDER_SERVICE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Renderer responded with ${response.status}: ${response.statusText}`);
    }

    // Assuming the renderer returns JSON (like a job ID or status)
    const data = await response.json();
    console.log("Render Request Successful:", data);
    
    return data;

  } catch (error) {
    console.error("Failed to request video render:", error.message);
    throw error;
  }
}
