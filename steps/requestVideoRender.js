import fetch from "node-fetch";
import { Storage } from "@google-cloud/storage";

const RUNPOD_ENDPOINT = "https://api.runpod.ai/v2/ujp39pddbnrfeg";
const POLL_INTERVAL_MS = 10_000;
const GCS_BUCKET = process.env.GCS_BUCKET_NAME;
const STATE_FILE = "render_state.json";

const storage = new Storage();

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function writeState(state) {
  if (!GCS_BUCKET) return;
  const bucket = storage.bucket(GCS_BUCKET);
  const file = bucket.file(STATE_FILE);
  await file.save(JSON.stringify(state, null, 2), {
    contentType: "application/json"
  });
}

async function pollRunPod(jobId) {
  while (true) {
    await sleep(POLL_INTERVAL_MS);

    const res = await fetch(`${RUNPOD_ENDPOINT}/status/${jobId}`, {
      headers: {
        "Authorization": `Bearer ${process.env.RUNPOD_API_KEY}`
      }
    });

    if (!res.ok) {
      throw new Error(`RunPod status check failed: ${res.status}`);
    }

    const json = await res.json();
    console.log("[Render] Poll status:", json);

    await writeState({ jobId, status: json.status, updated: new Date().toISOString() });

    if (json.status === "COMPLETED") {
      const url = json?.output?.url;
      if (!url) {
        throw new Error("Render completed but no URL returned");
      }
      return { url };
    }

    if (json.status === "FAILED") {
      throw new Error(`Render failed: ${JSON.stringify(json)}`);
    }
  }
}

export async function requestVideoRender(audioData, imageMap) {
  console.log("Preparing Render Payload...");

  const audioUrl = audioData?.fileUrl || audioData;
  if (!audioUrl || typeof audioUrl !== "string") {
    throw new Error("Renderer payload missing required audio URL");
  }

  const images = [];
  let lastValidUrl = null;

  for (let i = 1; i <= 5; i++) {
    const url = imageMap[`section_${i}`];
    if (typeof url === "string" && url.length > 0) {
      lastValidUrl = url;
      images.push(url);
    } else if (lastValidUrl) {
      images.push(lastValidUrl);
    }
  }

  while (images.length > 0 && images.length < 5) {
    images.push(images[images.length - 1]);
  }

  if (images.length === 0) {
    throw new Error("Renderer payload missing image URLs");
  }

  const payload = {
    input: {
      images,
      audio: audioUrl,
      render: {
        duration: 56,
        fps: 30,
        width: 1080,
        height: 1920,
        transition: "cut"
      }
    }
  };

  console.log("[Render] Sending payload to RunPod");

  const submit = await fetch(`${RUNPOD_ENDPOINT}/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.RUNPOD_API_KEY}`
    },
    body: JSON.stringify(payload)
  });

  if (!submit.ok) {
    const err = await submit.text();
    throw new Error(`Render submit failed: ${err}`);
  }

  const job = await submit.json();
  console.log("[Render] Job accepted:", job);

  if (!job.id) {
    throw new Error("RunPod did not return a job ID");
  }

  await writeState({ jobId: job.id, status: "IN_QUEUE", created: new Date().toISOString() });

  return await pollRunPod(job.id);
}
