// steps/triggerZapier.js

export async function triggerZapier({ title, description, videoUrl, tags }) {
  console.log("Triggering Zapier Webhook...");
  const webhookUrl = "https://hooks.zapier.com/hooks/catch/19867794/uw8xf2r/";

  const payload = {
    title,
    description,
    videoUrl,
    tags
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Zapier returned status: ${response.status}`);
    }

    console.log("✅ Zapier webhook triggered successfully.");
  } catch (error) {
    // We log the error but don't throw it, because we don't want to fail the 
    // whole orchestration if just the webhook fails.
    console.error("❌ Failed to trigger Zapier:", error.message);
  }
}
