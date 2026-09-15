export function isDevLoginEnabled(env: Record<string, string | undefined>): boolean {
  return env.NODE_ENV !== "production" && env.DEV_LOGIN === "1";
}
