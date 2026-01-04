import { GoogleGenAI } from "@google/genai";
import { Storage } from "@google-cloud/storage";
import fs from "fs";

// 1. Initialize Client GLOBALLY to enable Connection Pooling
// This prevents "fetch failed" by reusing sockets instead of opening new ones for every image.
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const storage = new Storage();
const bucketName = process.env.GCS_BUCKET_NAME;

// Configuration
const GLOBAL_TIMEOUT_MS = 180000; // 3 minutes total allowed time

export async function generateImages(promptSections) {
  console.log("Starting Parallel Image Generation (Shared Client + Aggressive Retry)...");

  const keys = Object.keys(promptSections);
  
  // Create a deadline timestamp
  const deadline = Date.now() + GLOBAL_TIMEOUT_MS;

  const imagePromises = keys.map(async (key, index) => {
    const sectionText = promptSections[key];
    
    // Tiny stagger (200ms) to prevent simultaneous DNS lookup spike
    // This is invisible to the user but helps Node.js handle the load.
    await new Promise(r => setTimeout(r, index * 200));

    // --- INFINITE RETRY LOOP (Until Timeout) ---
    // We loop until we get a result or hit the global deadline.
    // This swallows "fetch failed" errors and just tries again.
    while (Date.now() < deadline) {
      try {
        console.log(`Generating ${key}...`);

        const textPart = {
          text: `Create a whimsical, illustration set in a magical, fantasy world. Use a playful, storybook art style. Focus on creating an enchanting, imaginative atmosphere. Ensure the illustration feels like a scene from a children's storybook based on this story section: ${sectionText}`
        };

        const config = {
          imageConfig: { aspectRatio: "9:16" }, // Correct for Flash
          // CRITICAL FIX: Allow TEXT so the model can report errors instead of hanging
          responseModalities: ["TEXT", "IMAGE"], 
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "OFF" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "OFF" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "OFF" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "OFF" }
          ],
          temperature: 0.7
        };

        // 1. Setup Timeout for THIS specific request
        // Flash is fast, but we give it 40s to be safe.
        const requestTimeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Request Timed Out")), 40000)
        );

        // 2. Execute API Call
        const apiCall = ai.models.generateContent({
          model: "gemini-2.5-flash-image",
          contents: [{ role: "user", parts: [textPart] }],
          config: config
        });

        const response = await Promise.race([apiCall, requestTimeoutPromise]);

        // 3. Process Response
        const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        
        if (imagePart) {
          const buffer = Buffer.from(imagePart.inlineData.data, "base64");
          const fileName = `image-${key}-${Date.now()}.png`;
          const tempFilePath = `/tmp/${fileName}`;
          
          fs.writeFileSync(tempFilePath, buffer);

          await storage.bucket(bucketName).upload(tempFilePath, {
            destination: fileName,
            metadata: { contentType: "image/png", cacheControl: "public, max-age=31536000" },
          });

          const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
          console.log(`✅ Success: ${key}`);
          return { key, url: publicUrl };
        } 
        
        // If we got text (refusal) or empty, we throw to trigger a retry
        const textPartResponse = response.candidates?.[0]?.content?.parts?.find(p => p.text);
        if (textPartResponse) {
           console.warn(`⚠️ Model returned text for ${key}. Retrying...`);
           throw new Error("Model returned text mode");
        }
        throw new Error("No image data in response");

      } catch (error) {
        // --- ERROR HANDLING & BACKOFF ---
        const isNetworkError = error.message.includes("fetch failed") || error.message.includes("Timed Out");
        
        if (isNetworkError) {
          console.log(`🔄 Network glitch on ${key} (${error.message}). Retrying in 2s...`);
          await new Promise(r => setTimeout(r, 2000)); // Quick retry for network drops
        } else {
          console.warn(`⚠️ Error on ${key}: ${error.message}. Retrying in 5s...`);
          await new Promise(r => setTimeout(r, 5000)); // Longer retry for other errors
        }
      }
    }

    // If loop finishes without returning, we timed out
    console.error(`❌ Timed out waiting for ${key}`);
    return { key, url: null };
  });

  const resultsArray = await Promise.all(imagePromises);

  const results = {};
  resultsArray.forEach(item => {
    if (item) results[item.key] = item.url;
  });

  return results;
}
