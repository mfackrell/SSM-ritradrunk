import { GoogleGenerativeAI } from "@google/generative-ai";
import { Storage } from "@google-cloud/storage";
import fs from "fs";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const storage = new Storage();
const bucketName = process.env.GCS_BUCKET_NAME; // You must set this ENV var

export async function generateAudio({ text, tone }) {
  console.log("Generating audio via Gemini TTS", { tone, textLength: text?.length });

  // 1. Generate Audio
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro-preview-tts" });
  const prompt = `In a ${tone} voice, say the following text:\n\n${text}`;

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } }
      }
    }
  });

  const audioPart = result.response.candidates[0].content.parts.find(
    p => p.inlineData?.mimeType?.startsWith("audio/")
  );

  if (!audioPart) throw new Error("Gemini returned no audio data");

  // 2. Save locally to /tmp (required buffer step)
  const buffer = Buffer.from(audioPart.inlineData.data, "base64");
  const fileName = `narration-${Date.now()}.wav`;
  const tempFilePath = `/tmp/${fileName}`;
  fs.writeFileSync(tempFilePath, buffer);

  console.log("Audio generated locally:", tempFilePath);

  // 3. Upload to Google Cloud Storage
  if (!bucketName) {
    throw new Error("Missing env var: GCS_BUCKET_NAME");
  }

  console.log(`Uploading to bucket: ${bucketName}...`);
  
  await storage.bucket(bucketName).upload(tempFilePath, {
    destination: fileName,
    public: true, // Makes the file publicly accessible
    metadata: {
      contentType: "audio/wav",
      cacheControl: "public, max-age=31536000",
    },
  });

  // 4. Construct Public URL
  // Format: https://storage.googleapis.com/YOUR_BUCKET_NAME/FILENAME
  const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;

  console.log("File uploaded successfully:", publicUrl);

  return { 
    fileUrl: publicUrl,
    filePath: tempFilePath,
    mimeType: "audio/wav" 
  };
}
