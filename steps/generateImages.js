import { GoogleGenAI } from "@google/genai";
import { Storage } from "@google-cloud/storage";
import fs from "fs";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const storage = new Storage();
const bucketName = process.env.GCS_BUCKET_NAME;

export async function generateImages(promptSections) {
  console.log("Starting Parallel Image Generation...");

  // 1. Create a "job" for every section to run at the same time
  const imagePromises = Object.entries(promptSections).map(async ([key, sectionText]) => {
    try {
      console.log(`Requesting ${key}...`);
      
      const fullPrompt = `Create a whimsical, illustration set in a magical, fantasy world. Use a playful, storybook art style. Focus on creating an enchanting, imaginative atmosphere. Ensure the illustration feels like a scene from a children's storybook based on this story section: ${sectionText}`;

      const response = await ai.models.generateContent({
        model: "gemini-3-pro-image-preview",
        contents: [{ 
          role: "user", 
          parts: [{ text: fullPrompt }] // Text only (No daisy chaining)
        }],
        config: {
          imageConfig: { aspectRatio: "9:16", imageSize: "2K" },
          responseModalities: ["IMAGE"],
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "OFF" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "OFF" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "OFF" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "OFF" }
          ],
          temperature: 0.7
        }
      });

      const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);

      if (!imagePart) {
        console.warn(`No image generated for ${key}`);
        return null;
      }

      // Save to GCS
      const buffer = Buffer.from(imagePart.inlineData.data, "base64");
      const fileName = `image-${key}-${Date.now()}.png`;
      const tempFilePath = `/tmp/${fileName}`;
      fs.writeFileSync(tempFilePath, buffer);

      await storage.bucket(bucketName).upload(tempFilePath, {
        destination: fileName,
        metadata: { contentType: "image/png", cacheControl: "public, max-age=31536000" },
      });

      const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
      console.log(`Success: ${key} -> ${publicUrl}`);
      
      // Return the result for this specific image
      return { key, url: publicUrl };

    } catch (error) {
      console.error(`Failed to generate ${key}:`, error.message);
      return null;
    }
  });

  // 2. Wait for ALL jobs to finish (Parallel)
  const completedImages = await Promise.all(imagePromises);

  // 3. Reconstruct the results object
  const results = {};
  completedImages.forEach(item => {
    if (item) {
      results[item.key] = item.url;
    }
  });

  return results;
}
