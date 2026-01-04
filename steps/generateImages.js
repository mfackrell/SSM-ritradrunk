import { GoogleGenAI } from "@google/genai";
import { Storage } from "@google-cloud/storage";
import fs from "fs";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const storage = new Storage();
const bucketName = process.env.GCS_BUCKET_NAME;

// Configuration
const MAX_RETRIES = 3;
const REQUEST_TIMEOUT_MS = 45000; // 45 seconds hard limit per attempt

export async function generateImages(promptSections) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY; cannot generate images.");
  }
  if (!bucketName) {
    throw new Error("Missing GCS_BUCKET_NAME; cannot upload generated images.");
  }
  if (!promptSections || typeof promptSections !== "object" || !Object.keys(promptSections).length) {
    throw new Error("promptSections must be a non-empty object of prompts.");
  }

  console.log("Starting Parallel Image Generation (Model: gemini-2.5-flash)...");
  console.log("[Images] Sections to generate:", Object.keys(promptSections));

  const imagePromises = Object.entries(promptSections).map(async ([key, sectionText]) => {
    
    let attempt = 1;
    let lastError = null;

    while (attempt <= MAX_RETRIES) {
      console.log(`Generating ${key} (Attempt ${attempt}/${MAX_RETRIES})...`);

      const logTimer = setInterval(() => {
        console.log(`...still waiting for ${key} (Attempt ${attempt})...`);
      }, 15000);

      try {
        const textPart = {
          text: `Create a whimsical, illustration set in a magical, fantasy world. Use a playful, storybook art style. Focus on creating an enchanting, imaginative atmosphere. Ensure the illustration feels like a scene from a children's storybook based on this story section: ${sectionText}`
        };

        const config = {
          imageConfig: { aspectRatio: "9:16", imageSize: "2K" },
          responseModalities: ["IMAGE"],
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "OFF" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "OFF" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "OFF" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "OFF" }
          ],
          temperature: 0.7
        };

        // Timeout Promise
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Request Timed Out")), REQUEST_TIMEOUT_MS)
        );

        // API Call with new model
        const apiCall = ai.models.generateContent({
          model: "gemini-2.5-flash", // Updated to 2.5 Flash
          contents: [{ role: "user", parts: [textPart] }],
          config: config
        });

        const response = await Promise.race([apiCall, timeoutPromise]);

        clearInterval(logTimer);

        const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);

        if (!imagePart) {
          throw new Error("API returned success but no image data found.");
        }

        // Process and Upload
        const buffer = Buffer.from(imagePart.inlineData.data, "base64");
        const fileName = `image-${key}-${Date.now()}.png`;
        const tempFilePath = `/tmp/${fileName}`;
        
        fs.writeFileSync(tempFilePath, buffer);

        await storage.bucket(bucketName).upload(tempFilePath, {
          destination: fileName,
          metadata: { contentType: "image/png", cacheControl: "public, max-age=31536000" },
        });

        const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
        console.log(`✅ Success: ${key} -> ${publicUrl}`);

        return { key, url: publicUrl };

      } catch (error) {
        clearInterval(logTimer);
        lastError = error;
        console.warn(`⚠️ Failed ${key} (Attempt ${attempt}): ${error?.message || error}`);

        if (attempt === MAX_RETRIES) {
          console.error(`❌ Permanent Failure for ${key} after ${MAX_RETRIES} attempts.`, lastError);
          return { key, url: null, error: lastError?.message || "Unknown error" };
        }
        
        attempt++;
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  });

  const resultsArray = await Promise.all(imagePromises);

  const results = {};
  resultsArray.forEach(item => {
    results[item.key] = item.url;
  });

  const failedKeys = resultsArray.filter(item => !item.url).map(item => item.key);
  if (failedKeys.length) {
    console.error("[Images] One or more generations failed:", failedKeys);
    throw new Error(`Image generation failed for sections: ${failedKeys.join(", ")}`);
  }

  return results;
}
