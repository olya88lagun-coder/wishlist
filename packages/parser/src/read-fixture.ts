import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function readFixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), "utf8");
}
