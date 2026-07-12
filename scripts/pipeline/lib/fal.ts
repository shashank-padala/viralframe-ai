import { sleep } from "./retry";

const FAL_QUEUE_BASE = "https://queue.fal.run";
const DEFAULT_POLL_INTERVAL_MS = 5000;
const DEFAULT_MAX_POLL_ATTEMPTS = 120;

interface FalSubmitResponse {
  request_id: string;
  status_url: string;
  response_url: string;
}

interface FalStatusResponse {
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED";
}

// Submits a job to fal.ai's queue API and polls it to completion.
//
// Deliberately uses the status_url/response_url fal.ai returns in the
// submit response rather than constructing them from modelId ourselves --
// for models with a multi-segment path (e.g.
// "fal-ai/kling-video/v2.5-turbo/pro/text-to-video"), the status/result
// endpoints live at a shortened base app path ("fal-ai/kling-video"), not
// the full submit path. Guessing that produced a 405 on every poll;
// trusting fal.ai's own returned URLs is the correct fix and works for
// any model shape.
export async function falSubmitAndAwaitResult<T>(
  modelId: string,
  body: Record<string, unknown>,
  options: { pollIntervalMs?: number; maxPollAttempts?: number } = {}
): Promise<T> {
  const apiKey = process.env.FAL_KEY;
  if (!apiKey) throw new Error("FAL_KEY is not set");

  const headers = {
    Authorization: `Key ${apiKey}`,
    "Content-Type": "application/json",
  };

  const submitRes = await fetch(`${FAL_QUEUE_BASE}/${modelId}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!submitRes.ok) {
    throw new Error(
      `fal.ai ${modelId} submit failed: ${submitRes.status} ${await submitRes.text()}`
    );
  }
  const { status_url: statusUrl, response_url: resultUrl } =
    (await submitRes.json()) as FalSubmitResponse;
  if (!statusUrl || !resultUrl) {
    throw new Error(`fal.ai ${modelId} submit response is missing status_url/response_url`);
  }

  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const maxPollAttempts = options.maxPollAttempts ?? DEFAULT_MAX_POLL_ATTEMPTS;

  let completed = false;
  for (let attempt = 0; attempt < maxPollAttempts; attempt++) {
    const statusRes = await fetch(statusUrl, { headers });
    if (!statusRes.ok) {
      throw new Error(
        `fal.ai ${modelId} status check failed: ${statusRes.status} ${await statusRes.text()}`
      );
    }
    const status = (await statusRes.json()) as FalStatusResponse;
    if (status.status === "COMPLETED") {
      completed = true;
      break;
    }
    await sleep(pollIntervalMs);
  }
  if (!completed) {
    throw new Error(`fal.ai ${modelId} job timed out waiting for completion`);
  }

  const resultRes = await fetch(resultUrl, { headers });
  if (!resultRes.ok) {
    throw new Error(
      `fal.ai ${modelId} result fetch failed: ${resultRes.status} ${await resultRes.text()}`
    );
  }
  return (await resultRes.json()) as T;
}

export async function downloadFromUrl(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
