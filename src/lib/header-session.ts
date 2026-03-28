import { getUserSession } from "@/lib/user-auth";

export type HeaderSession = {
  userId: string;
};

export async function getHeaderSession(): Promise<HeaderSession | null> {
  const session = await getUserSession();
  if (!session?.userId) {
    return null;
  }
  return { userId: session.userId };
}
