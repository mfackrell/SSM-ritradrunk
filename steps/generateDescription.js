import OpenAI from "openai";

const openai = new OpenAI();

export async function generateDescription(trailerText) {
  const prompt = `
Based on the source content below, generate metadata for a YouTube video.

Source content:
${trailerText}

Output Requirements (JSON format):
1. "title": A catchy, SEO-friendly YouTube title suitable for this story.
2. "description": A short, engaging description (2–4 concise sentences).
   - Clear, compelling, for general audiences.
   - No hashtags, no emojis.
   - Do NOT mention Amazon.
3. "keywords": An array of 5–8 relevant YouTube keywords/tags.

Return ONLY valid JSON.
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a helpful marketing assistant. You output strictly JSON." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" }, // Forces structured output
      temperature: 0.7,
    });

    const content = completion.choices[0].message.content;
    const parsed = JSON.parse(content);

    return {
      title: parsed.title,
      description: parsed.description,
      keywords: parsed.keywords
    };
  } catch (error) {
    console.error("Error generating YouTube metadata:", error);
    // Return empty structure on failure to prevent crashes
    return { title: null, description: null, keywords: [] }; 
  }
}
