import { GoogleGenAI } from "@google/genai";
import { Storage } from "@google-cloud/storage";
import fs from "fs";

// 1. GLOBAL Client (Crucial for Connection Pooling)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const storage = new Storage();
const bucketName = process.env.GCS_BUCKET_NAME;

// Configuration
const GLOBAL_TIMEOUT_MS = 180000; // 3 minutes total allowed time

export async function generateImages(promptSections) {
  console.log("Starting Ramp-Up Parallel Image Generation...");

  const keys = Object.keys(promptSections);
  const deadline = Date.now() + GLOBAL_TIMEOUT_MS;

  const imagePromises = keys.map(async (key, index) => {
    const sectionText = promptSections[key];
    
    // --- RAMP-UP DELAY (The Fix) ---
    // Start requests 2 seconds apart. 
    // This allows the network stack to handle the SSL handshakes one by one 
    // while still keeping the generation parallel.
    // Index 0 starts at 0s, Index 1 at 2s, Index 2 at 4s...
    const startDelay = index * 2000; 
    console.log(`⏳ Scheduling ${key} to start in ${startDelay/1000}s...`);
    await new Promise(r => setTimeout(r, startDelay));

    // --- INFINITE RETRY LOOP ---
    while (Date.now() < deadline) {
      try {
        console.log(`🚀 Generating ${key}...`);

        const textPart = {
          text: `Create a whimsical, illustration set in a magical, fantasy world. Use a playful, storybook art style. Focus on creating an enchanting, imaginative atmosphere. Ensure the illustration feels like a scene from a children's storybook based on this story section: ${sectionText}`
        };

        const config = {
          imageConfig: { aspectRatio: "9:16" },
          // Allow TEXT to prevent hanging on refusals
          responseModalities: ["TEXT", "IMAGE"], 
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "OFF" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "OFF" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "OFF" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "OFF" }
          ],
          temperature: 0.7
        };

        // 40s Soft Timeout for each attempt
        const requestTimeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Request Timed Out")), 40000)
        );

        const apiCall = ai.models.generateContent({
          model: "gemini-2.5-flash-image",
          contents: [{ role: "user", parts: [textPart] }],
          config: config
        });

        const response = await Promise.race([apiCall, requestTimeoutPromise]);

        // Process Response
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
        
        // Handle Text Refusal
        const textPartResponse = response.candidates?.[0]?.content?.parts?.find(p => p.text);
        if (textPartResponse) {
           throw new Error(`Model returned text: "${textPartResponse.text.substring(0,50)}..."`);
        }
        throw new Error("No content in response");

      } catch (error) {
        // --- ERROR HANDLER ---
        const isNetworkError = error.message.includes("fetch failed") || error.message.includes("Timed Out");
        
        if (isNetworkError) {
          console.log(`🔄 Network glitch on ${key}. Retrying in 2s...`);
          await new Promise(r => setTimeout(r, 2000));
        } else {
          console.warn(`⚠️ API Error on ${key}: ${error.message}. Retrying in 5s...`);
          await new Promise(r => setTimeout(r, 5000));
        }
      }
    }

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
