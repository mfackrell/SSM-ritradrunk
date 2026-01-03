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
    try {
      const isFirstImage = loopIndex === 0;
      const currentTemp = isFirstImage ? 0.3 : 0.7; 

      console.log(`Generating ${key} (Index: ${loopIndex})...`);

      // --- THE FIX IS HERE ---
      // We removed the hardcoded "Whimsical" text. 
      // Now it uses EXACTLY what came from the previous step.
      const fullPrompt = sectionText; 

      const parts = [{ text: fullPrompt }];

      if (lastImageBuffer) {
        parts.push({
          inlineData: {
            data: lastImageBuffer.toString("base64"),
            mimeType: "image/png"
          }
        });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3-pro-image-preview",
        contents: [{ role: "user", parts: parts }],
        config: {
          responseModalities: ["IMAGE"],
          temperature: currentTemp
        }
      });

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
