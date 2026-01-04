import { GoogleGenAI } from "@google/genai";
import { Storage } from "@google-cloud/storage";
import fs from "fs";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const storage = new Storage();
const bucketName = process.env.GCS_BUCKET_NAME;

export async function generateImages(promptSections) {
  console.log("Starting Parallel Image Generation...");

  // Convert object entries into an array of Promises to execute in parallel
  const imagePromises = Object.entries(promptSections).map(async ([key, sectionText]) => {
    
    // 1. Setup specific logging for this independent request
    console.log(`Initiating generation for ${key}...`);

    // Start the "Still Waiting" timer for this specific request
    const timer = setInterval(() => {
      console.log(`...still waiting for Gemini Image API on ${key} (30s elapsed)...`);
    }, 30000);

    try {
      const fullPrompt = sectionText;

      const textPart = {
        text: `Create a whimsical, illustration set in a magical, fantasy world. Use a playful, storybook art style. Focus on creating an enchanting, imaginative atmosphere. Ensure the illustration feels like a scene from a children's storybook based on this story section: ${fullPrompt}`
      };

      // Strict text-only input (No previous images)
      const parts = [textPart];

      const config = {
        imageConfig: {
          aspectRatio: "9:16",
          imageSize: "2K",
        },
        responseModalities: ["IMAGE"],
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "OFF" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "OFF" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "OFF" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "OFF" }
        ],
        // Standardized temperature for parallel generation
        temperature: 0.7 
      };

      // Generate content directly (No daisy-chain fallback needed)
      const response = await ai.models.generateContent({
        model: "gemini-3-pro-image-preview",
        contents: [{ role: "user", parts: parts }],
        config: config
      });

      const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);

      if (!imagePart) {
        console.warn(`No image generated for ${key}`);
        return { key, url: null };
      }

      const buffer = Buffer.from(imagePart.inlineData.data, "base64");
      const fileName = `image-${key}-${Date.now()}.png`;
      const tempFilePath = `/tmp/${fileName}`;
      
      fs.writeFileSync(tempFilePath, buffer);

      await storage.bucket(bucketName).upload(tempFilePath, {
        destination: fileName,
        metadata: { contentType: "image/png", cacheControl: "public, max-age=31536000" },
      });

      const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
      console.log(`Saved ${key} -> ${publicUrl}`);

      return { key, url: publicUrl };

    } catch (error) {
      console.error(`Failed to generate image for ${key}:`, error.message);
      return { key, url: null };
    } finally {
      // Clear the specific timer for this request
      clearInterval(timer);
    }
  });

  // Wait for all promises to resolve
  const resultsArray = await Promise.all(imagePromises);

  // Convert the array of results back into an object
  const results = {};
  resultsArray.forEach(item => {
    results[item.key] = item.url;
  });

  return results;
}
