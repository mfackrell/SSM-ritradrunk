import { GoogleGenAI } from "@google/genai";
import { Storage } from "@google-cloud/storage";
import fs from "fs";

// 1. Initialize the NEW SDK
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const storage = new Storage();
const bucketName = process.env.GCS_BUCKET_NAME;

export async function generateImages(promptSections) {
  console.log("Starting Sequential Image Generation (New SDK)...");

  const results = {};
  let lastImageBuffer = null;
  let loopIndex = 0;

  for (const [key, sectionText] of Object.entries(promptSections)) {
    try {
      const isFirstImage = loopIndex === 0;
      // High creativity for follow-up images
      const currentTemp = isFirstImage ? 0.4 : 1.0; 

      console.log(`Generating ${key} (Index: ${loopIndex})...`);

      const fullPrompt = `Create a whimsical, illustration set in a magical, fantasy world. Use a playful, storybook art style. Focus on creating an enchanting, imaginative atmosphere. Ensure the illustration feels like a scene from a children's storybook based on: ${sectionText}. Output at 9:16 aspect ratio.`;

      // 2. Build the Content Parts (New SDK format)
      const parts = [{ text: fullPrompt }];

      if (lastImageBuffer) {
        parts.push({
          inlineData: {
            data: lastImageBuffer.toString("base64"),
            mimeType: "image/png"
          }
        });
      }

      // 3. Call the API (Correct New Syntax)
      // Note: We use `ai.models.generateContent`, not `model.generateContent`
      const response = await ai.models.generateContent({
        model: "gemini-3-pro-image-preview",
        contents: [
          {
            role: "user",
            parts: parts
          }
        ],
        config: {
          responseModalities: ["IMAGE"],
          temperature: currentTemp
        }
      });

      // 4. Extract the Image (New Response Structure)
      const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);

      if (!imagePart) {
        console.warn(`No image generated for ${key}`);
        results[key] = null;
        loopIndex++;
        continue;
      }

      // 5. Save & Upload
      lastImageBuffer = Buffer.from(imagePart.inlineData.data, "base64");
      const fileName = `image-${key}-${Date.now()}.png`;
      const tempFilePath = `/tmp/${fileName}`;
      fs.writeFileSync(tempFilePath, lastImageBuffer);

      await storage.bucket(bucketName).upload(tempFilePath, {
        destination: fileName,
        metadata: { contentType: "image/png", cacheControl: "public, max-age=31536000" },
      });

      const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
      console.log(`Saved ${key} -> ${publicUrl}`);

      results[key] = publicUrl;
      loopIndex++;

    } catch (error) {
      console.error(`Failed to generate image for ${key}:`, error.message);
      results[key] = null;
      loopIndex++;
    }
  }

  return results;
}
