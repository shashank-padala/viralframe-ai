import { transcribeUrl } from "../../caption/lib/deepgram";
import type { Transcript } from "../lib/types";

// Deepgram fetches the video directly from a signed URL rather than us
// streaming multi-GB source files through the runner's own memory.
//
// The request itself now lives in `caption/lib/deepgram.ts` so the hosted
// pipeline and the local captioning CLI cannot drift on which Deepgram
// features they ask for -- caption quality depends on several of them
// (punctuated words, utterance boundaries, filler words), and a transcript
// missing them silently produces worse captions rather than an error.
export async function transcribe(sourceVideoUrl: string): Promise<Transcript> {
  return transcribeUrl(sourceVideoUrl);
}
