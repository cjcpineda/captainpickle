import { notFound } from "next/navigation";
import { requireCaptain } from "@/lib/auth.ts";
import { Strategist } from "@/components/Strategist.tsx";

export default async function ChatPage({ params }: { params: Promise<{ chatId: string }> }) {
  const [captain, { chatId }] = await Promise.all([requireCaptain(), params]);
  const id = Number(chatId);
  if (!Number.isInteger(id)) notFound();
  return <Strategist captain={captain} chatId={id} />;
}
