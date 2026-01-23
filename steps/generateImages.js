import { Storage } from "@google-cloud/storage";
import fs from "fs";

const storage = new Storage();
const bucketName = process.env.GCS_BUCKET_NAME;

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const RUNPOD_ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_ID;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runpodSubmit(prompt, numInferenceSteps = 4) {
  const url = `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/run`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RUNPOD_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      input: {
        prompt,
        num_inference_steps: numInferenceSteps
      }
    })
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`RunPod submit failed (${res.status}): ${txt}`);
  }

  const data = await res.json();
  const jobId = data?.id;
  if (!jobId) throw new Error(`RunPod submit response missing job id: ${JSON.stringify(data)}`);
  return jobId;
}

async function runpodPoll(jobId, maxPolls = 30, pollEveryMs = 2000) {
  const url = `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/status/${jobId}`;

  for (let i = 0; i < maxPolls; i++) {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${RUNPOD_API_KEY}`,
        "Content-Type": "application/json"
      }
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`RunPod status failed (${res.status}): ${txt}`);
    }

    const data = await res.json();
    const status = data?.status;

    if (status === "COMPLETED") {
      const output = data?.output || {};
      const images = output?.images || [];
      const imageBase64 = images?.[0]?.image;

      if (!imageBase64) {
        throw new Error(`RunPod completed but no image in payload: ${JSON.stringify(data)}`);
      }

      return imageBase64;
    }

    if (status === "FAILED") {
      throw new Error(`RunPod job failed: ${JSON.stringify(data)}`);
    }

    await sleep(pollEveryMs);
  }

  throw new Error("RunPod timed out waiting for completion");
}

export async function generateImages(promptSections) {
  console.log("Starting Sequential Image Generation...");

  const results = {};
  let lastImageBuffer = null;
  let loopIndex = 0;

  for (const [key, sectionText] of Object.entries(promptSections)) {
    console.log(`Generating ${key} (Index: ${loopIndex})...`);

    const timer = setInterval(() => {
      console.log(`...still waiting for RunPod SDXL on ${key} (30s elapsed)...`);
    }, 30000);

    try {
      const fullPrompt = sectionText;

      const finalPrompt =
        `Create a whimsical, illustration set in a magical, fantasy world. ` +
        `Use a playful, storybook art style. Focus on creating an enchanting, imaginative atmosphere. ` +
        `Ensure the illustration feels like a scene from a children's storybook based on this story section: ${fullPrompt}`;

      const jobId = await runpodSubmit(finalPrompt, 4);
      const imageBase64 = await runpodPoll(jobId, 30, 2000);

      lastImageBuffer = Buffer.from(imageBase64, "base64");

      const fileName = `image-${key}-${Date.now()}.png`;
      const tempFilePath = `/tmp/${fileName}`;
      fs.writeFileSync(tempFilePath, lastImageBuffer);

      await storage.bucket(bucketName).upload(tempFilePath, {
        destination: fileName,
        metadata: { contentType: "image/png", cacheControl: "public, max-age=31536000" },
        resumable: false,
        retryOptions: {
          autoRetry: true,
          retryDelayMultiplier: 2,
          totalTimeoutSeconds: 60,
          maxRetries: 3,
        }
      });

      const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
      console.log(`Saved ${key} -> ${publicUrl}`);

      results[key] = publicUrl;
      loopIndex++;
    } catch (error) {
      console.error(`Failed to generate image for ${key}:`, error?.message || error);
      results[key] = null;
      loopIndex++;
    } finally {
      clearInterval(timer);
    }
  }

  return results;
}
