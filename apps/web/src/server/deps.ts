import type { AuthDeps } from "./auth-service";
import { getDb } from "./db";
import { getEnv } from "./env";

export function authDeps(): AuthDeps {
  return { db: getDb(), env: getEnv(), now: () => new Date(), fetchFn: (input, init) => fetch(input, init) };
}
