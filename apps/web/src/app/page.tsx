import { redirect } from "next/navigation";
import { readViewer } from "@/server/viewer";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { user } = await readViewer();
  redirect(user ? "/lists" : "/login");
}
