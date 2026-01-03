import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function extractBookMetadata(reference) {
  console.log("Extracting Book Metadata via GPT-4o...");

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0,
      messages: [
        { 
          role: "user", 
          content: `return only the book title and author (URL Encoded as in the following example) for this  reference: ${reference}\ni.e. title=Adventures%20of%20huckleberry%20finn&author=mark%20twain` 
        }
      ]
    });

    const result = response.choices[0].message.content.trim();
    console.log("Metadata Extracted:", result);
    return result;

  } catch (error) {
    console.error("Failed to extract metadata:", error.message);
    return null;
  }
}
