import { CloudTasksClient } from "@google-cloud/tasks";

const client = new CloudTasksClient();

export async function scheduleNextRun(originalPayload) {
  // Configuration
  const project = "social-stream-webhook"; // From your screenshot
  const queue = "ssm-delay-queue";         // The queue we named earlier
  const location = "us-central1";
  const url = "https://ssm-ritrareal-710616455963.us-central1.run.app"; // Your NEW service URL
  
  // Construct the parent queue path
  const parent = client.queuePath(project, location, queue);

  // Set the schedule time (24 hours from now)
  const seconds = 24 * 60 * 60;
  const in24Hours = Date.now() / 1000 + seconds;

  const task = {
    httpRequest: {
      httpMethod: "POST",
      url: url,
      headers: {
        "Content-Type": "application/json",
      },
      body: Buffer.from(JSON.stringify(originalPayload)).toString("base64"),
    },
    scheduleTime: {
      seconds: in24Hours,
    },
  };

  try {
    const [response] = await client.createTask({ parent, task });
    console.log(`Scheduled next run: ${response.name}`);
    return response.name;
  } catch (error) {
    console.error("Failed to schedule next run:", error);
    // We don't want to crash the whole flow if scheduling fails, so just return null
    return null;
  }
}
