import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function getStoryTone(title) {
  if (!title) throw new Error("getStoryTone: title is required");

  console.log("Determining story tone...");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: `In a single word, define the tone of this story: ${title}`,
      },
    ],
    temperature: 1.0,
    max_tokens: 5, // intentionally small — one word only
  });

  const tone = response.choices[0].message.content.trim();

  console.log("Story tone:", tone);

  return tone;
}
