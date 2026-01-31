import { Storage } from "@google-cloud/storage";
import fs from "fs";

const storage = new Storage();
const bucketName = process.env.GCS_BUCKET_NAME;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function startSdxlJob(prompt) {
  const res = await fetch(
    "https://sdxl-manager-710616455963.us-central1.run.app",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    }
  );

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`SDXL start failed (${res.status}): ${txt}`);
  }

  const data = await res.json();

  if (!data.jobId) {
    throw new Error(`SDXL did not return jobId: ${JSON.stringify(data)}`);
  }

  return data.jobId;
}

async function pollSdxlJob(jobId, maxAttempts = 30) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(
      "https://sdxl-manager-710616455963.us-central1.run.app",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId })
      }
    );

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`SDXL poll failed (${res.status}): ${txt}`);
    }

    const data = await res.json();

    if (data.status === "success" && data.public_url) {
      return data.public_url;
    }

    if (data.status === "error") {
      throw new Error(`SDXL job failed: ${JSON.stringify(data)}`);
    }

    console.log(`SDXL job ${jobId} still pending (attempt ${attempt})`);
    await sleep(3000);
  }

  throw new Error(`SDXL job ${jobId} timed out`);
}


export async function generateImages(promptSections) {
  console.log("Starting Sequential Image Generation...");

  const results = {};
  let loopIndex = 0;

  for (const [key, sectionText] of Object.entries(promptSections)) {
    console.log(`Generating ${key} (Index: ${loopIndex})...`);

    const timer = setInterval(() => {
      console.log(`...still waiting for SDXL on ${key} (30s elapsed)...`);
    }, 30000);

    try {
      const fullPrompt =
        `Create a whimsical, illustration set in a magical, fantasy world. ` +
        `Use a playful, storybook art style. Focus on creating an enchanting, imaginative atmosphere. ` +
        `Ensure the illustration feels like a scene from a children's storybook based on this story section: ${sectionText}`;

      const jobId = await startSdxlJob(fullPrompt);
      const publicUrl = await pollSdxlJob(jobId);


      console.log(`Saved ${key} -> ${publicUrl}`);
      results[key] = publicUrl;
      loopIndex++;

    } catch (err) {
      console.error(`Failed to generate image for ${key}:`, err.message);
      results[key] = null;
      loopIndex++;

    } finally {
      clearInterval(timer);
    }
  }

  return results;
}
