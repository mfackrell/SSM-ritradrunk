import { GoogleGenerativeAI } from "@google/generative-ai";
import { Storage } from "@google-cloud/storage";
import fs from "fs";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const storage = new Storage();
const bucketName = process.env.GCS_BUCKET_NAME;

export async function generateImages(promptSections) {
  console.log("Starting Sequential Image Generation (Daisy Chain)...");

  const model = genAI.getGenerativeModel({ model: "imagen-3.0-generate-001" });

  const results = {};
  let lastImageBuffer = null;
  let loopIndex = 0; // Tracks if we are on image 1, 2, 3...

  for (const [key, sectionText] of Object.entries(promptSections)) {
    try {
      const isFirstImage = loopIndex === 0;
      
      // LOGIC: Image 1 is the "Anchor" (stable). 
      // Images 2-5 are "Evolutions" (creative, so we raise temperature).
      const currentTemp = isFirstImage ? 0.4 : 0.85; 

      console.log(`Generating ${key} (Index: ${loopIndex})...`);
      console.log(`- Reference Image: ${isFirstImage ? "None" : "Attached"}`);
      console.log(`- Temperature: ${currentTemp}`);

      const fullPrompt = `Create a whimsical, illustration set in a magical, fantasy world. Use a playful, storybook art style. Focus on creating an enchanting, imaginative atmosphere. Ensure the illustration feels like a scene from a children's storybook based on: ${sectionText}`;

      // Build payload
      const contentParts = [{ text: fullPrompt }];

      // Attach previous image if it exists (Daisy Chain)
      if (lastImageBuffer) {
        contentParts.push({
          inlineData: {
            data: lastImageBuffer.toString("base64"),
            mimeType: "image/png"
          }
        });
      }

      const result = await model.generateContent({
        contents: [{ role: "user", parts: contentParts }],
        generationConfig: {
          aspectRatio: "9:16",
          responseModalities: ["IMAGE"],
          temperature: currentTemp // <--- Applied here
        }
      });

      const imagePart = result.response.candidates[0].content.parts.find(
        p => p.inlineData?.mimeType?.startsWith("image/")
      );

      if (!imagePart) {
        console.warn(`No image generated for ${key}`);
        results[key] = null;
        // Do not increment loopIndex or clear buffer if failed, 
        // to try and keep the chain alive? 
        // Actually better to just move on so we don't hang.
        loopIndex++;
        continue;
      }

      // Update the buffer for the NEXT iteration
      lastImageBuffer = Buffer.from(imagePart.inlineData.data, "base64");

      // Save to GCS
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
