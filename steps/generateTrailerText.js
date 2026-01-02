import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // We will set this in Cloud Run next
});

export async function generateTrailerText(bookTitle) {
  if (!bookTitle) throw new Error("generateTrailerText: No book title provided");

  console.log("Generating trailer text for:", bookTitle);

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `create an engaging and capivating summary of this book. it should be akin to movie trailer. limit 180 words. This needs to be exciting attention grabbing and captivating to the audience. Capture the climax of the story in a bold yet intriguing way that makes the consumer want to read the whole book. The description should be ironic, stupid akin to a story that a drunk person would tell. Maintain the telling of the story but interject nonsensicial statements that will catch the viewer off guard make it entertaining. only return the summary do not describe what was done or give any other commentary. Return in paragraph form not with bullet points or stars`
      },
      {
        role: "user",
        content: bookTitle
      }
    ],
    temperature: 1, // High temperature for "drunk" randomness
  });

  const trailerText = response.choices[0].message.content;
  console.log("Generated Trailer Text:", trailerText);

  return trailerText;
}
