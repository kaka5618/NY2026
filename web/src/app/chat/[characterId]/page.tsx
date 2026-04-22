import { ChatPageClient } from "@/components/ChatPageClient";

interface ChatPageProps {
  params: Promise<{ characterId: string }>;
}

/**
 * 动态聊天路由：将 segment 交给客户端会话组件
 */
export default async function ChatPage({ params }: ChatPageProps) {
  const { characterId } = await params;
  return <ChatPageClient characterId={characterId} />;
}
