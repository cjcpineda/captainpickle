import { requireCaptain } from "@/lib/auth.ts";
import { Strategist } from "@/components/Strategist.tsx";

export default async function NewChatPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [captain, { q }] = await Promise.all([requireCaptain(), searchParams]);
  return <Strategist captain={captain} chatId={null} prompt={q} />;
}
