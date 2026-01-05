import { GoogleGenAI } from "@google/genai";
import { Storage } from "@google-cloud/storage";
import fs from "fs";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const storage = new Storage();
const bucketName = process.env.GCS_BUCKET_NAME;

export async function generateImages(promptSections) {
  console.log("Starting Sequential Image Generation...");

  const results = {};
  let lastImageBuffer = null;
  let loopIndex = 0;

  for (const [key, sectionText] of Object.entries(promptSections)) {
    
  // 1. Setup specific logging for this section
    console.log(`Generating ${key} (Index: ${loopIndex})...`);
    
    // Start the "Still Waiting" timer for this specific request
    const timer = setInterval(() => {
      console.log(`...still waiting for Gemini Image API on ${key} (30s elapsed)...`);
    }, 30000);  
    
    try {
      const isFirstImage = loopIndex === 0;
      const currentTemp = isFirstImage ? 0.3 : 0.7; 

      console.log(`Generating ${key} (Index: ${loopIndex})...`);

      const fullPrompt = sectionText; 

      // I used backticks (`) here because 'children's' has an apostrophe 
      // which breaks the single quotes in your original string.
      const textPart = { 
        text: `Create a whimsical, illustration set in a magical, fantasy world. Use a playful, storybook art style. Focus on creating an enchanting, imaginative atmosphere. Ensure the illustration feels like a scene from a children's storybook based on this story section: ${fullPrompt}` 
      };

      const parts = [textPart];

      if (lastImageBuffer) {
        parts.push({
          inlineData: {
            data: lastImageBuffer.toString("base64"),
            mimeType: "image/png"
          }
        });
      }

      // Kept YOUR Model Name and YOUR Safety Settings
      const config = {
        imageConfig:{ 
          aspectRatio:"9:16",
          },      
        responseModalities: ["IMAGE"],
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "OFF" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "OFF" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "OFF" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "OFF" }
        ],
        temperature: currentTemp
      };

      let response;

      // --- FALLBACK LOGIC ADDED ---
      try {
        // Attempt 1: Try with Daisy Chain (Text + Image)
        response = await ai.models.generateContent({
          model: "gemini-2.5-flash-image",
          contents: [{ role: "user", parts: parts }],
          config: config
        });

      } catch (networkError) {
        console.warn(`Daisy Chain failed for ${key}. Retrying with text only...`);
        
        // Attempt 2: Fallback (Text Only)
        // Uses the same model and settings you requested
        response = await ai.models.generateContent({
          model: "gemini-2.5-flash-image",
          contents: [{ role: "user", parts: [textPart] }],
          config: config
        });
      }
      // --- END FALLBACK LOGIC ---

      const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);

      if (!imagePart) {
        console.warn(`No image generated for ${key}`);
        results[key] = null;
        loopIndex++;
        continue;
      }

      lastImageBuffer = Buffer.from(imagePart.inlineData.data, "base64");
      const fileName = `image-${key}-${Date.now()}.png`;
      const tempFilePath = `/tmp/${fileName}`;
      fs.writeFileSync(tempFilePath, lastImageBuffer);

      // UPDATED: Added retry logic for unstable network connections
      await storage.bucket(bucketName).upload(tempFilePath, {
        destination: fileName,
        metadata: { contentType: "image/png", cacheControl: "public, max-age=31536000" },
        resumable: false, // Turn off resumable for small files (often more stable)
        retryOptions: {
          autoRetry: true,
          retryDelayMultiplier: 2,
          totalTimeoutSeconds: 60,
          maxRetries: 3,
        }
      });

      const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
      console.log(`Saved ${key} -> ${publicUrl}`);

      results[key] = publicUrl;
      loopIndex++;

    } catch (error) {
      console.error(`Failed to generate image for ${key}:`, error.message);
      results[key] = null;
      loopIndex++;
    }finally {
      // 2. CRITICAL: STOP THE TIMER
      clearInterval(timer);
    }
  }

  return results;
}
