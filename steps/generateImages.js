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
  console.log("Starting Parallel Image Generation (Model: gemini-2.5-flash-image)...");

  const imagePromises = Object.entries(promptSections).map(async ([key, sectionText]) => {
    
    let attempt = 1;

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
          imageConfig: { aspectRatio: "9:16"},
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
          model: "gemini-2.5-flash-image", // Updated to 2.5 Flash
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
        console.warn(`⚠️ Failed ${key} (Attempt ${attempt}): ${error.message}`);

        if (attempt === MAX_RETRIES) {
          console.error(`❌ Permanent Failure for ${key} after ${MAX_RETRIES} attempts.`);
          return { key, url: null };
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

  return results;
}
