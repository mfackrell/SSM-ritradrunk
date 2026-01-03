import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function extractBookMetadata(reference) {
  console.log("Extracting Book Metadata via GPT-4o...");

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { 
          role: "user", 
          content: `return only the book title and author for this  reference: ${reference}\ni.e. title=Adventures_of_huckleberry_finn&author=mark_twain` 
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
