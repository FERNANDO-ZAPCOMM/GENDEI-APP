'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Bot, User, Send, Play, Pause, Clock, Archive, Trash2, MoreVertical, AlertTriangle, MessageSquare, X } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { useClinic } from '@/hooks/use-clinic';
import { useAuth } from '@/hooks/use-auth';
import { useMessagingWindow } from '@/hooks/use-messaging-window';
import { getConversationStateColor } from '@/lib/meta-utils';
import {
  useConversation,
  useConversationMessages,
  useTakeoverConversation,
  useReleaseConversation,
  useSendMessage,
  useArchiveConversation,
  useDeleteConversation,
} from '@/hooks/use-conversations';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { PageLoader } from '@/components/PageLoader';
import { ChatBubble } from '@/components/chat/ChatBubble';
import type { Message as BubbleMessage } from '@/components/chat/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function ConversationDetailPage() {
  const t = useTranslations();
  const params = useParams();
  const router = useRouter();
  const { currentClinic: clinic } = useClinic();
  const { currentUser } = useAuth();

  const conversationId = params.id as string;

  const { conversation, isLoading, refetch } = useConversation(
    clinic?.id || '',
    conversationId
  );
  const { messages, isLoading: messagesLoading } = useConversationMessages(
    clinic?.id || '',
    conversationId
  );

  // 24h window and queue management
  const {
    isWindowOpen,
    reengagementSentAt,
    queuedMessages,
    queuedMessagesCount,
    queueMessage,
    clearQueue,
    sendQueue,
    sendReengagement,
  } = useMessagingWindow(clinic?.id || '', conversationId);

  const takeoverMutation = useTakeoverConversation();
  const releaseMutation = useReleaseConversation();
  const sendMessageMutation = useSendMessage();
  const archiveMutation = useArchiveConversation();
  const deleteMutation = useDeleteConversation();

  const [messageInput, setMessageInput] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const getConversationStateLabel = (state: string): string => {
    switch (state) {
      case 'novo':
        return t('conversations.state.novo');
      case 'new':
        return t('conversations.state.new');
      case 'qualificado':
        return t('conversations.state.qualificado');
      case 'negociando':
        return t('conversations.state.negociando');
      case 'fechado':
        return t('conversations.state.fechado');
      case 'checkout':
        return t('conversations.state.checkout');
      case 'greeting':
        return t('conversations.state.greeting');
      case 'engaged':
        return t('conversations.state.engaged');
      case 'selecting_slot':
        return t('conversations.state.selecting_slot');
      case 'scheduling':
        return t('conversations.state.scheduling');
      case 'confirming':
        return t('conversations.state.confirming');
      case 'awaiting_greeting_response':
        return t('conversations.state.awaiting_greeting_response');
      case 'awaiting_appointment_action':
        return t('conversations.state.awaiting_appointment_action');
      case 'in_patient_info_flow':
        return t('conversations.state.in_patient_info_flow');
      default:
        return state.replace(/_/g, ' ');
    }
  };

  const getAppointmentTagConfig = (status?: string): { label: string; classes: string } | null => {
    if (!status) return null;
    switch (status) {
      case 'pending':
        return { label: t('appointmentsPage.status.pending'), classes: 'bg-amber-50 text-amber-900 border-amber-200' };
      case 'confirmed':
        return { label: t('appointmentsPage.status.confirmed'), classes: 'bg-blue-50 text-blue-900 border-blue-200' };
      case 'awaiting_confirmation':
        return { label: t('appointmentsPage.status.awaiting'), classes: 'bg-orange-50 text-orange-900 border-orange-200' };
      case 'confirmed_presence':
        return { label: t('appointmentsPage.status.confirmedPresence'), classes: 'bg-emerald-50 text-emerald-900 border-emerald-200' };
      case 'completed':
        return { label: t('appointmentsPage.status.completed'), classes: 'bg-green-50 text-green-900 border-green-200' };
      case 'cancelled':
        return { label: t('appointmentsPage.status.cancelled'), classes: 'bg-gray-50 text-gray-600 border-gray-200 opacity-60' };
      case 'no_show':
        return { label: t('appointmentsPage.status.noShow'), classes: 'bg-red-50 text-red-800 border-red-200 opacity-60' };
      default:
        return null;
    }
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleTakeover = async () => {
    if (!clinic?.id || !currentUser?.uid) return;

    try {
      await takeoverMutation.mutateAsync({
        clinicId: clinic.id,
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
    if (!clinic?.id) return;

    try {
      await releaseMutation.mutateAsync({
        clinicId: clinic.id,
        conversationId,
      });
      toast.success(t('conversations.release.success'));
      refetch();
    } catch (error) {
      toast.error(t('conversations.release.error'));
    }
  };

  const handleSendMessage = async () => {
    if (!clinic?.id || !currentUser?.uid || !messageInput.trim()) return;

    // If window is closed, queue the message instead
    if (!isWindowOpen) {
      try {
        await queueMessage.mutateAsync(messageInput.trim());
        setMessageInput('');
        toast.success(t('conversations.queue.messageQueued'));
      } catch (error) {
        toast.error(t('conversations.queue.queueError'));
      }
      return;
    }

    // Window is open, send directly
    try {
      await sendMessageMutation.mutateAsync({
        clinicId: clinic.id,
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

  const handleSendReengagement = async () => {
    try {
      await sendReengagement.mutateAsync();
      toast.success(t('conversations.reengagement.sent'));
    } catch (error) {
      toast.error(t('conversations.reengagement.error'));
    }
  };

  const handleSendQueue = async () => {
    try {
      const result = await sendQueue.mutateAsync();
      const data = (result as any).data;
      toast.success(t('conversations.queue.sent', { count: data?.sent || 0 }));
    } catch (error) {
      toast.error(t('conversations.queue.sendError'));
    }
  };

  const handleClearQueue = async () => {
    try {
      await clearQueue.mutateAsync();
      toast.success(t('conversations.queue.cleared'));
    } catch (error) {
      toast.error(t('conversations.queue.clearError'));
    }
  };

  const handleArchive = async () => {
    if (!clinic?.id) return;

    try {
      await archiveMutation.mutateAsync({
        clinicId: clinic.id,
        conversationId,
      });
      toast.success('Conversa arquivada');
      router.push('/dashboard/conversations');
    } catch (error) {
      toast.error('Erro ao arquivar conversa');
    }
  };

  const handleDelete = async () => {
    if (!clinic?.id) return;

    try {
      await deleteMutation.mutateAsync({
        clinicId: clinic.id,
        conversationId,
      });
      toast.success('Conversa excluída');
      router.push('/dashboard/conversations');
    } catch (error) {
      toast.error('Erro ao excluir conversa');
    }
  };

  if (isLoading || !conversation) {
    return <PageLoader message={t('conversations.loading')} />;
  }

  const isHumanControl = conversation.isHumanTakeover;
  const canSendMessages = isHumanControl && conversation.state !== 'fechado';
  const appointmentTag = getAppointmentTagConfig(conversation.appointmentContext?.status);

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] gap-4 page-transition">
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
            {getConversationStateLabel(conversation.state)}
          </Badge>
          {appointmentTag && (
            <Badge variant="outline" className={appointmentTag.classes}>
              {appointmentTag.label}
            </Badge>
          )}
          {isHumanControl && (
            <Badge variant="outline" className="text-blue-600 border-blue-600">
              {t('conversations.handler.human')}
            </Badge>
          )}

          {/* Actions Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleArchive}>
                <Archive className="h-4 w-4 mr-2" />
                Arquivar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setShowDeleteDialog(true)}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conversa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A conversa e todas as mensagens serão excluídas permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Control Bar - Compact */}
      <div className={`flex items-center justify-between p-3 rounded-lg border flex-shrink-0 ${
        isHumanControl ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
      }`}>
        <div className="flex items-center gap-3">
          <Badge className={isHumanControl ? 'bg-blue-600' : 'bg-purple-600'}>
            {isHumanControl ? (
              <><User className="h-3 w-3 mr-1" /> {t('conversations.handler.human')}</>
            ) : (
              <><Bot className="h-3 w-3 mr-1" /> {t('conversations.handler.ai')}</>
            )}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {isHumanControl
              ? t('conversations.control.humanDescription')
              : t('conversations.control.aiDescription')}
          </span>

          {/* 24h Window Status */}
          {isHumanControl && (
            <Badge
              variant="outline"
              className={isWindowOpen
                ? 'text-green-600 border-green-600 bg-green-50'
                : 'text-amber-600 border-amber-600 bg-amber-50'
              }
            >
              <Clock className="h-3 w-3 mr-1" />
              {isWindowOpen ? t('conversations.window.open') : t('conversations.window.closed')}
            </Badge>
          )}
        </div>

        {conversation.state !== 'fechado' && (
          <div>
            {isHumanControl ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRelease}
                disabled={releaseMutation.isPending}
              >
                <Play className="h-4 w-4 mr-2" />
                {t('conversations.control.releaseToAI')}
              </Button>
            ) : (
              <Button
                size="sm"
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

      {/* 24h Window Alert - Only show when in human control and window is closed */}
      {isHumanControl && !isWindowOpen && (
        <div className="flex items-center justify-between p-3 rounded-lg border border-amber-300 bg-amber-50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span className="text-sm text-amber-800">
              {t('conversations.window.closedMessage')}
            </span>
            {reengagementSentAt && (
              <Badge variant="outline" className="text-amber-700 border-amber-400">
                {t('conversations.reengagement.sentAt', {
                  time: format(new Date(reengagementSentAt), 'HH:mm')
                })}
              </Badge>
            )}
          </div>
          {!reengagementSentAt && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleSendReengagement}
              disabled={sendReengagement.isPending}
              className="border-amber-400 text-amber-700 hover:bg-amber-100"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              {t('conversations.reengagement.send')}
            </Button>
          )}
        </div>
      )}

      {/* Queued Messages Alert */}
      {isHumanControl && queuedMessagesCount > 0 && (
        <div className="flex items-center justify-between p-3 rounded-lg border border-blue-300 bg-blue-50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-blue-600" />
            <span className="text-sm text-blue-800">
              {t('conversations.queue.count', { count: queuedMessagesCount })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClearQueue}
              disabled={clearQueue.isPending}
              className="text-blue-700 hover:bg-blue-100"
            >
              <X className="h-4 w-4 mr-1" />
              {t('conversations.queue.clear')}
            </Button>
            {isWindowOpen && (
              <Button
                size="sm"
                onClick={handleSendQueue}
                disabled={sendQueue.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Send className="h-4 w-4 mr-1" />
                {t('conversations.queue.sendAll')}
              </Button>
            )}
          </div>
        </div>
      )}

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
                const isOutbound = message.direction === 'out' || message.isAiGenerated || message.isHumanSent;
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
                onKeyDown={handleKeyPress}
                placeholder={t('conversations.messages.placeholder')}
                className="min-h-[60px] max-h-[120px]"
                disabled={sendMessageMutation.isPending || queueMessage.isPending}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!messageInput.trim() || sendMessageMutation.isPending || queueMessage.isPending}
                className="self-end"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {isWindowOpen
                ? t('conversations.messages.hint')
                : t('conversations.messages.hintWindowClosed')
              }
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
