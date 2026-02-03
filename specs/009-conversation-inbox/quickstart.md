# Quickstart: Conversation Inbox

**Feature**: 009-conversation-inbox
**Date**: 2026-02-04

---

## Conversation List Component

```typescript
// apps/web/src/components/inbox/ConversationList.tsx
'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface Conversation {
  id: string;
  patientName: string;
  patientPhone: string;
  lastMessagePreview: string;
  lastMessageAt: Date;
  unreadCount: number;
  aiEnabled: boolean;
  status: string;
}

interface ConversationListProps {
  clinicId: string;
  selectedId?: string;
  onSelect: (conversation: Conversation) => void;
}

export function ConversationList({ clinicId, selectedId, onSelect }: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'gendei_conversations'),
      where('clinicId', '==', clinicId),
      orderBy('lastMessageAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const convs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        lastMessageAt: doc.data().lastMessageAt?.toDate(),
      })) as Conversation[];

      setConversations(convs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [clinicId]);

  if (loading) {
    return <ConversationListSkeleton />;
  }

  return (
    <div className="flex flex-col divide-y">
      {conversations.map((conv) => (
        <button
          key={conv.id}
          onClick={() => onSelect(conv)}
          className={cn(
            'flex items-start gap-3 p-4 text-left hover:bg-muted/50 transition-colors',
            selectedId === conv.id && 'bg-muted'
          )}
        >
          <Avatar>
            <AvatarFallback>
              {conv.patientName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium truncate">{conv.patientName}</span>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(conv.lastMessageAt, { addSuffix: true, locale: ptBR })}
              </span>
            </div>

            <p className="text-sm text-muted-foreground truncate">
              {conv.lastMessagePreview}
            </p>

            <div className="flex items-center gap-2 mt-1">
              {conv.unreadCount > 0 && (
                <Badge variant="default" className="h-5 min-w-5 justify-center">
                  {conv.unreadCount}
                </Badge>
              )}
              {!conv.aiEnabled && (
                <Badge variant="outline" className="text-xs">
                  Manual
                </Badge>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
```

---

## Chat Panel Component

```typescript
// apps/web/src/components/inbox/ChatPanel.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  content: string;
  direction: 'inbound' | 'outbound';
  sender: 'patient' | 'ai' | 'staff';
  timestamp: Date;
  status: string;
}

interface ChatPanelProps {
  conversationId: string;
  clinicId: string;
  patientName: string;
  aiEnabled: boolean;
  onHandoff: () => void;
  onRelease: () => void;
}

export function ChatPanel({
  conversationId,
  clinicId,
  patientName,
  aiEnabled,
  onHandoff,
  onRelease,
}: ChatPanelProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'gendei_messages'),
      where('conversationId', '==', conversationId),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate(),
      })) as Message[];

      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;

    setSending(true);
    try {
      await addDoc(collection(db, 'gendei_messages'), {
        conversationId,
        clinicId,
        direction: 'outbound',
        sender: 'staff',
        senderName: user?.displayName,
        type: 'text',
        content: input.trim(),
        status: 'pending',
        timestamp: Timestamp.now(),
        createdAt: Timestamp.now(),
      });
      setInput('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h2 className="font-semibold">{patientName}</h2>
          <p className="text-sm text-muted-foreground">
            {aiEnabled ? 'IA ativa' : 'Modo manual'}
          </p>
        </div>

        {aiEnabled ? (
          <Button variant="outline" onClick={onHandoff}>
            Assumir conversa
          </Button>
        ) : (
          <Button variant="outline" onClick={onRelease}>
            Devolver para IA
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite sua mensagem..."
            className="min-h-[80px] resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button onClick={handleSend} disabled={!input.trim() || sending}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isOutbound = message.direction === 'outbound';

  return (
    <div className={cn('flex gap-2', isOutbound && 'flex-row-reverse')}>
      <div className="flex-shrink-0">
        {message.sender === 'ai' ? (
          <Bot className="h-6 w-6 text-primary" />
        ) : message.sender === 'staff' ? (
          <User className="h-6 w-6 text-muted-foreground" />
        ) : null}
      </div>

      <div
        className={cn(
          'max-w-[70%] rounded-lg px-4 py-2',
          isOutbound
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted'
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        <p className="text-xs opacity-70 mt-1">
          {message.timestamp?.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
          {isOutbound && message.status && (
            <span className="ml-2">{getStatusIcon(message.status)}</span>
          )}
        </p>
      </div>
    </div>
  );
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'sent': return '✓';
    case 'delivered': return '✓✓';
    case 'read': return '✓✓';
    case 'failed': return '✕';
    default: return '○';
  }
}
```

---

## Handoff Controller

```typescript
// apps/functions/src/controllers/conversationController.ts
import { db, FieldValue } from '../lib/firebase';

export async function handoffToStaff(req: Request, res: Response) {
  const clinicId = req.clinicId!;
  const userId = req.userId!;
  const { conversationId } = req.params;

  const conversationRef = db.collection('gendei_conversations').doc(conversationId);
  const conversation = await conversationRef.get();

  if (!conversation.exists) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  if (conversation.data()?.clinicId !== clinicId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  await conversationRef.update({
    aiEnabled: false,
    aiPausedAt: FieldValue.serverTimestamp(),
    aiPausedBy: userId,
    assignedTo: userId,
    assignedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Add system message
  await db.collection('gendei_messages').add({
    conversationId,
    clinicId,
    direction: 'outbound',
    sender: 'system',
    type: 'text',
    content: 'Atendimento assumido por um membro da equipe.',
    status: 'delivered',
    timestamp: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  });

  return res.json({ success: true, assignedTo: userId });
}

export async function releaseToAI(req: Request, res: Response) {
  const clinicId = req.clinicId!;
  const { conversationId } = req.params;

  const conversationRef = db.collection('gendei_conversations').doc(conversationId);
  const conversation = await conversationRef.get();

  if (!conversation.exists) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  if (conversation.data()?.clinicId !== clinicId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  await conversationRef.update({
    aiEnabled: true,
    aiPausedAt: FieldValue.delete(),
    aiPausedBy: FieldValue.delete(),
    assignedTo: FieldValue.delete(),
    assignedAt: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return res.json({ success: true, aiEnabled: true });
}

export async function markAsRead(req: Request, res: Response) {
  const clinicId = req.clinicId!;
  const { conversationId } = req.params;

  const conversationRef = db.collection('gendei_conversations').doc(conversationId);
  const conversation = await conversationRef.get();

  if (!conversation.exists || conversation.data()?.clinicId !== clinicId) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  await conversationRef.update({
    unreadCount: 0,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return res.json({ success: true });
}
```

---

## Quick Replies Component

```typescript
// apps/web/src/components/inbox/QuickReplies.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { MessageSquarePlus } from 'lucide-react';

interface QuickReply {
  id: string;
  label: string;
  content: string;
  variables: string[];
}

interface QuickRepliesProps {
  replies: QuickReply[];
  variables: Record<string, string>;
  onSelect: (content: string) => void;
}

export function QuickReplies({ replies, variables, onSelect }: QuickRepliesProps) {
  const [open, setOpen] = useState(false);

  const interpolate = (content: string) => {
    return content.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || `{{${key}}}`);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon">
          <MessageSquarePlus className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Respostas rápidas</h4>
          <div className="grid gap-2">
            {replies.map((reply) => (
              <Button
                key={reply.id}
                variant="outline"
                className="justify-start h-auto py-2"
                onClick={() => {
                  onSelect(interpolate(reply.content));
                  setOpen(false);
                }}
              >
                <div className="text-left">
                  <div className="font-medium">{reply.label}</div>
                  <div className="text-xs text-muted-foreground truncate max-w-[250px]">
                    {interpolate(reply.content)}
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

---

## Inbox Page Layout

```typescript
// apps/web/src/app/[locale]/dashboard/inbox/page.tsx
'use client';

import { useState } from 'react';
import { useClinic } from '@/hooks/useClinic';
import { ConversationList } from '@/components/inbox/ConversationList';
import { ChatPanel } from '@/components/inbox/ChatPanel';
import { PatientSidebar } from '@/components/inbox/PatientSidebar';
import { api } from '@/lib/api';

export default function InboxPage() {
  const { clinic } = useClinic();
  const [selectedConversation, setSelectedConversation] = useState<any>(null);

  const handleHandoff = async () => {
    if (!selectedConversation) return;
    await api.post(`/conversations/${selectedConversation.id}/handoff`);
  };

  const handleRelease = async () => {
    if (!selectedConversation) return;
    await api.post(`/conversations/${selectedConversation.id}/release`);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Conversation List */}
      <div className="w-80 border-r overflow-y-auto">
        <ConversationList
          clinicId={clinic.id}
          selectedId={selectedConversation?.id}
          onSelect={setSelectedConversation}
        />
      </div>

      {/* Chat Panel */}
      <div className="flex-1">
        {selectedConversation ? (
          <ChatPanel
            conversationId={selectedConversation.id}
            clinicId={clinic.id}
            patientName={selectedConversation.patientName}
            aiEnabled={selectedConversation.aiEnabled}
            onHandoff={handleHandoff}
            onRelease={handleRelease}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Selecione uma conversa
          </div>
        )}
      </div>

      {/* Patient Sidebar */}
      {selectedConversation && (
        <div className="w-80 border-l overflow-y-auto">
          <PatientSidebar patientId={selectedConversation.patientId} />
        </div>
      )}
    </div>
  );
}
```
