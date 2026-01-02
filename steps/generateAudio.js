import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function generateAudio({ tone, text }) {
  if (!tone) throw new Error("generateAudio: tone missing");
  if (!text) throw new Error("generateAudio: text missing");

  console.log("Generating audio...", { tone });

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-pro-preview-tts",
  });

  const prompt = `In a ${tone} voice, say the following text:\n\n${text}`;

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: "Zubenelgenubi",
          },
        },
      },
    },
  });

  const audioPart = result.response.candidates[0].content.parts.find(
    (p) => p.inlineData?.mimeType?.startsWith("audio/")
  );

  if (!audioPart) {
    throw new Error("No audio returned from Gemini");
  }

  const audioBuffer = Buffer.from(audioPart.inlineData.data, "base64");
  const filePath = `/tmp/narration-${Date.now()}.wav`;

  fs.writeFileSync(filePath, audioBuffer);

  console.log("Audio generated:", filePath);

  return {
    filePath,
    mimeType: audioPart.inlineData.mimeType,
  };
}
