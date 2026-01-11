export async function requestVideoRender(audioData, imageMap) {
  console.log("Preparing Render Payload...");

  // 1) Extract audio URL (must be a string)
  const audioUrl = audioData?.fileUrl || audioData;
  console.log("[Render] Raw audio input:", audioData);
  console.log("[Render] Resolved audioUrl:", audioUrl);

  if (!audioUrl || typeof audioUrl !== "string") {
    throw new Error("Renderer payload missing required audio URL");
  }

// 2) Ensure exactly 5 images by reusing successfully created ones if any fail
  const images = [];
  let lastValidUrl = null;

  for (let i = 1; i <= 5; i++) {
    const url = imageMap[`section_${i}`];
    
    if (typeof url === "string" && url.length > 0) {
      lastValidUrl = url;
      images.push(url);
    } else {
      console.warn(`[Render] Missing section_${i}. Reusing previous valid image.`);
      // Use the last successful image, or skip if none have succeeded yet
      if (lastValidUrl) images.push(lastValidUrl);
    }
  }

  // Final safety check: if section_1 failed, the array might still be short.
  // Backfill from the first successful image found.
  while (images.length > 0 && images.length < 5) {
    images.push(images[images.length - 1]);
  }
  console.log("[Render] Raw imageMap keys:", Object.keys(imageMap || {}));
  console.log("[Render] Filtered image URLs:", images);

  if (images.length === 0) {
    throw new Error("Renderer payload missing image URLs");
  }

  // 3) Construct Payload (urls only)
  const payload = {
    images,
    audio: audioUrl
  };

  // Log it so you can verify it matches expected JSON
  console.log("[Render] Sending Payload:", JSON.stringify(payload, null, 2));

  // 4) Send Request
  const response = await fetch("https://ffmpeg-test-710616455963.us-central1.run.app", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Render] Renderer response not OK:", response.status, response.statusText, errorText);
    throw new Error(`Renderer Failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const json = await response.json();
  console.log("[Render] Renderer success response:", json);

  // Return the raw response (e.g. { url: "..." })
  return json;
}
