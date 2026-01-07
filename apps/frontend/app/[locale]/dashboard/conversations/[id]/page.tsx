'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Bot, User, Send, Play, Pause, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { useCreator } from '@/hooks/use-creator';
import { useAuth } from '@/hooks/use-auth';
import { getConversationStateColor } from '@/lib/meta-utils';
import {
  useConversation,
  useConversationMessages,
  useTakeoverConversation,
  useReleaseConversation,
  useSendMessage,
} from '@/hooks/use-conversations';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { PageLoader } from '@/components/PageLoader';
import { ChatBubble } from '@/components/chat/ChatBubble';
import type { Message as BubbleMessage } from '@/components/chat/types';

export default function ConversationDetailPage() {
  const t = useTranslations();
  const params = useParams();
  const router = useRouter();
  const { currentCreator: creator } = useCreator();
  const { currentUser } = useAuth();

  const conversationId = params.id as string;

  const { conversation, isLoading, refetch } = useConversation(
    creator?.id || '',
    conversationId
  );
  const { messages, isLoading: messagesLoading } = useConversationMessages(
    creator?.id || '',
    conversationId
  );

  const takeoverMutation = useTakeoverConversation();
  const releaseMutation = useReleaseConversation();
  const sendMessageMutation = useSendMessage();

  const [messageInput, setMessageInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleTakeover = async () => {
    if (!creator?.id || !currentUser?.uid) return;

    try {
      await takeoverMutation.mutateAsync({
        creatorId: creator.id,
        conversationId,
        userId: currentUser.uid,
      });
      toast.success(t('conversations.takeover.success'));
      refetch();
    } catch (error) {
      toast.error(t('conversations.takeover.error'));
    }
  };

  const handleRelease = async () => {
    if (!creator?.id) return;

    try {
      await releaseMutation.mutateAsync({
        creatorId: creator.id,
        conversationId,
      });
      toast.success(t('conversations.release.success'));
      refetch();
    } catch (error) {
      toast.error(t('conversations.release.error'));
    }
  };

  const handleSendMessage = async () => {
    if (!creator?.id || !currentUser?.uid || !messageInput.trim()) return;

    try {
      await sendMessageMutation.mutateAsync({
        creatorId: creator.id,
        conversationId,
        message: messageInput.trim(),
        userId: currentUser.uid,
      });
      setMessageInput('');
      toast.success(t('conversations.message.sent'));
    } catch (error) {
      toast.error(t('conversations.message.error'));
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (isLoading || !conversation) {
    return <PageLoader message={t('conversations.loading')} />;
  }

  const isHumanControl = conversation.isHumanTakeover;
  const canSendMessages = isHumanControl && conversation.state !== 'fechado';

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] gap-6 page-transition">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {conversation.waUserName || conversation.waUserPhone || conversation.waUserId}
            </h1>
            <p className="text-sm text-muted-foreground">{conversation.waUserPhone}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={getConversationStateColor(conversation.state)}
          >
            {t(`conversations.state.${conversation.state}`)}
          </Badge>
          {isHumanControl && (
            <Badge variant="outline" className="text-blue-600 border-blue-600">
              {t('conversations.handler.human')}
            </Badge>
          )}
        </div>
      </div>

      {/* Control Panel */}
      <Card className="flex-shrink-0">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {isHumanControl ? (
                  <>
                    <User className="h-5 w-5 text-blue-600" />
                    {t('conversations.control.humanMode')}
                  </>
                ) : (
                  <>
                    <Bot className="h-5 w-5 text-purple-600" />
                    {t('conversations.control.aiMode')}
                  </>
                )}
              </CardTitle>
              <CardDescription>
                {isHumanControl
                  ? t('conversations.control.humanDescription')
                  : t('conversations.control.aiDescription')}
              </CardDescription>
            </div>

            {conversation.state !== 'fechado' && (
              <div>
                {isHumanControl ? (
                  <Button
                    variant="outline"
                    onClick={handleRelease}
                    disabled={releaseMutation.isPending}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    {t('conversations.control.releaseToAI')}
                  </Button>
                ) : (
                  <Button
                    onClick={handleTakeover}
                    disabled={takeoverMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Pause className="h-4 w-4 mr-2" />
                    {t('conversations.control.takeControl')}
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardHeader>

        {isHumanControl && conversation.takenOverAt && (
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>
                {t('conversations.control.takenOverAt', {
                  time: format(new Date(conversation.takenOverAt), 'MMM d, HH:mm'),
                })}
              </span>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Messages */}
      <Card className="flex-1 flex flex-col min-h-0">
        <CardHeader className="pb-3 flex-shrink-0">
          <CardTitle>{t('conversations.messages.title')}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
          {messagesLoading && messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <PageLoader message={t('conversations.messages.loading')} />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">{t('conversations.messages.empty')}</p>
            </div>
          ) : (
            <>
              {messages.map((message) => {
                const isOutbound = message.direction === 'out';
                const bubbleMessage: BubbleMessage = {
                  id: message.id,
                  who: isOutbound ? 'user' : 'bot',
                  text: message.body,
                  timestamp: new Date(message.timestamp),
                };
                return <ChatBubble key={message.id} message={bubbleMessage} variant="whatsapp" />;
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </CardContent>

        {/* Message Input */}
        {canSendMessages && (
          <CardContent className="border-t p-4 flex-shrink-0">
            <div className="flex gap-2">
              <Textarea
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={t('conversations.messages.placeholder')}
                className="min-h-[60px] max-h-[120px]"
                disabled={sendMessageMutation.isPending}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!messageInput.trim() || sendMessageMutation.isPending}
                className="self-end"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {t('conversations.messages.hint')}
            </p>
          </CardContent>
        )}

        {!canSendMessages && conversation.state !== 'fechado' && (
          <CardContent className="border-t p-4 bg-muted/50 flex-shrink-0">
            <p className="text-sm text-muted-foreground text-center">
              {t('conversations.messages.takeoverRequired')}
            </p>
          </CardContent>
        )}

        {conversation.state === 'fechado' && (
          <CardContent className="border-t p-4 bg-muted/50 flex-shrink-0">
            <p className="text-sm text-muted-foreground text-center">
              {t('conversations.messages.conversationClosed')}
            </p>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
