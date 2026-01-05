import { GoogleGenerativeAI } from "@google/generative-ai";
import { Storage } from "@google-cloud/storage";
import fs from "fs";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const storage = new Storage();
const bucketName = process.env.GCS_BUCKET_NAME;

// Helper function to create a valid WAV header
function addWavHeader(buffer, sampleRate = 24000) {
  const numChannels = 1;
  const bitDepth = 16;
  const byteRate = (sampleRate * numChannels * bitDepth) / 8;
  const blockAlign = (numChannels * bitDepth) / 8;
  const dataSize = buffer.length;
  const fileSize = 36 + dataSize;

  const header = Buffer.alloc(44);

  // RIFF chunk descriptor
  header.write("RIFF", 0);
  header.writeUInt32LE(fileSize, 4);
  header.write("WAVE", 8);

  // fmt sub-chunk
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitDepth, 34);

  // data sub-chunk
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, buffer]);
}

export async function generateAudio({ text, tone }) {
  console.log("Generating audio via Gemini TTS", { tone, textLength: text?.length });

  // Use the experimental model that supports audio
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro-preview-tts" });

  const prompt = `Read the following story text clearly and with a ${tone} tone. Do not add any introductory text, just read the story:\n\n${text}`;

  try {
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

    if (!audioPart) throw new Error("Gemini returned no audio data part.");

    // 1. Decode raw PCM data
    let rawBuffer = Buffer.from(audioPart.inlineData.data, "base64");
    
    // Safety check for empty files
    if (rawBuffer.length < 1024) {
      console.error("❌ Audio generation failed. Buffer is too small.");
      throw new Error("Generated audio file is corrupted or empty.");
    }

    // 2. Add the WAV Header (Fixes the FFmpeg error)
    // Gemini 2.0 Flash Audio usually defaults to 24kHz
    const wavBuffer = addWavHeader(rawBuffer, 24000);

    const fileName = `narration-${Date.now()}.wav`;
    const tempFilePath = `/tmp/${fileName}`;
    fs.writeFileSync(tempFilePath, wavBuffer);

    console.log("Audio generated & header added:", tempFilePath, `(${wavBuffer.length} bytes)`);

    // 3. Upload
    if (!bucketName) throw new Error("Missing env var: GCS_BUCKET_NAME");

    console.log(`Uploading to bucket: ${bucketName}...`);
    
    await storage.bucket(bucketName).upload(tempFilePath, {
      destination: fileName,
      metadata: {
        contentType: "audio/wav",
        cacheControl: "public, max-age=31536000",
      },
    });

    const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
    console.log("File uploaded successfully:", publicUrl);

    return { 
      fileUrl: publicUrl,
      filePath: tempFilePath,
      mimeType: "audio/wav" 
    };

  } catch (error) {
    console.error("Audio Generation Error:", error);
    throw error;
  }
}
