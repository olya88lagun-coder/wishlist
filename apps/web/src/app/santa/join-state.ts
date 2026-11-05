export type SantaJoinState = { status: "idle" | "error" | "success"; message: string | null; gameId: string | null; personalLink: string | null };

export const initialSantaJoinState: SantaJoinState = { status: "idle", message: null, gameId: null, personalLink: null };
