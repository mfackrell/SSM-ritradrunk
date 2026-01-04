export async function requestVideoRender(audioData, imageMap) {
  // 1. Get the Audio URL string (handling the object wrapper)
  const audioUrl = audioData.fileUrl || audioData;

  // 2. Create the Array of Image URL strings (Sorted Order)
  // We strictly extract the values (URLs) to ensure we send ["http...", "http..."]
  const images = Object.keys(imageMap)
    .sort((a, b) => {
      // Ensure section_1 comes before section_2
      const numA = parseInt(a.split('_')[1]);
      const numB = parseInt(b.split('_')[1]);
      return numA - numB;
    })
    .map(key => imageMap[key]) // <--- Extracts the URL string
    .filter(url => url);       // Removes any nulls

  // 3. Send the exact payload structure you defined
  const response = await fetch("https://ffmpeg-test-710616455963.us-central1.run.app", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      images: images,  // This is now strictly an Array of Strings
      audio: audioUrl  // This is a String
    })
  });

  if (!response.ok) {
    throw new Error(`Render request failed: ${response.status} ${response.statusText}`);
  }

  // Return the immediate response
  return await response.json();
}
