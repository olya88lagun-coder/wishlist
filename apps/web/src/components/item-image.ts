export function imageUrlFor(imageKey: string | null, publicBaseUrl: string | undefined): string | null {
  if (!imageKey || !publicBaseUrl) return null;
  const path = imageKey.split("/").map(encodeURIComponent).join("/");
  return `${publicBaseUrl.replace(/\/+$/, "")}/${path}`;
}
