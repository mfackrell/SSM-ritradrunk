import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function checkTrailerText(inputText) {
  if (!inputText) throw new Error("checkTrailerText: No input text provided");

  console.log("Checking and rephrasing text...");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini", // Specific model from screenshot
    messages: [
      {
        role: "system",
        content: "Rephrase this. this is critical command: This must NEVER exceed 150 words. for any reason. Make it exciting!"
      },
      {
        role: "user",
        content: inputText
      }
    ],
    temperature: 1.0,
    max_tokens: 1024,
  });

  const checkedText = response.choices[0].message.content;
  console.log("Checked Text:", checkedText);

  return checkedText;
}
