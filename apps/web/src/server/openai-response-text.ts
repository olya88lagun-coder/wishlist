// Raw Responses REST data uses output items; output_text is an SDK convenience.
export function openAiResponseText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const response = payload as { status?: unknown; output?: unknown; output_text?: unknown };
  if (response.status !== undefined && response.status !== "completed") return "";
  if (!Array.isArray(response.output)) return typeof response.output_text === "string" ? response.output_text : "";
  const texts: string[] = [];
  for (const item of response.output) {
    if (!item || item.type !== "message" || item.role !== "assistant") continue;
    if (item.status !== undefined && item.status !== "completed") return "";
    if (!Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (part?.type === "refusal") return "";
      if (part?.type === "output_text" && typeof part.text === "string") texts.push(part.text);
    }
  }
  return texts.join("");
}
