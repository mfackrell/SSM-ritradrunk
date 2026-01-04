export async function requestVideoRender(audioData, imageMap) {
  console.log("Preparing Render Payload...");

  // 1. Get Audio URL (Force String)
  // We handle both cases: if it's the object wrapper OR just the string
  const audioUrl = audioData?.fileUrl || audioData;

  // 2. Get Image URLs (Force Array of Strings)
  // We sort by "section_1", "section_2" to ensure order
  const images = Object.keys(imageMap)
    .sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, '')) || 0; 
      const numB = parseInt(b.replace(/\D/g, '')) || 0;
      return numA - numB;
    })
    .map(key => imageMap[key]);

  // 3. Construct Payload EXACTLY like Zapier
  const payload = {
    images: images,
    audio: audioUrl
  };

  // Log it so you can verify it matches your Zapier JSON
  console.log("Sending Payload:", JSON.stringify(payload, null, 2));

  // 4. Send Request
  const response = await fetch("https://ffmpeg-test-710616455963.us-central1.run.app", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Renderer Failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  // Return the raw response (e.g. { url: "..." })
  return await response.json();
}
