import { users } from "./schema";
import type { Database } from "./types";

export async function createUserFixture(db: Database, displayName = "Маша"): Promise<string> {
  const [user] = await db.insert(users).values({ displayName }).returning({ id: users.id });
  return user!.id;
}
