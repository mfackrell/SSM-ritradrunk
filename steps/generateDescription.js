import OpenAI from "openai";

const openai = new OpenAI();

export async function generateDescription(trailerText) {
  const prompt = `
Create a short, engaging YouTube description based on the content below.

Requirements:
- 2–4 concise sentences
- Clear, compelling, and written for general audiences
- No hashtags
- No emojis
- Do NOT mention Amazon explicitly in the prose

Source content:
${trailerText}
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a helpful marketing assistant." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    });

    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error("Error generating YouTube description:", error);
    return null;
  }
}
