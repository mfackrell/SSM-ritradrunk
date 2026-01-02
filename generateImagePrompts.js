// steps/generateImagePrompts.js

export async function generateImagePrompts(text, numSections = 5) {
  console.log("Generating image prompts (splitting text)...");

  // 1. Split text into words (regex handles multiple spaces/newlines)
  const words = text.trim().split(/\s+/);
  
  // 2. Calculate words per section
  const wordsPerSection = Math.floor(words.length / numSections);
  
  let sections = [];
  let currentIndex = 0;

  for (let i = 0; i < numSections; i++) {
    let chunk;

    // Handle the last section to include all "leftovers"
    if (i === numSections - 1) {
      chunk = words.slice(currentIndex);
    } else {
      chunk = words.slice(currentIndex, currentIndex + wordsPerSection);
      currentIndex += wordsPerSection;
    }

    // Join and clean up quotes
    let sectionStr = chunk.join(" ").replace(/["“”‘’]/g, "").trim();
    sections.push(sectionStr);
  }

  // 3. Format output (section_1, section_2, etc.)
  let output = {};
  sections.forEach((sec, index) => {
    output[`section_${index + 1}`] = sec;
  });

  console.log("Image prompts generated:", output);
  return output;
}
