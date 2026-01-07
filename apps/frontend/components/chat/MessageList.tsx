'use client';

import { useEffect, useRef } from 'react';
import { ChatBubble } from './ChatBubble';
import { TypingIndicator } from './TypingIndicator';
import type { Message } from './types';
import { cn } from '@/lib/utils';

interface MessageListProps {
  messages: Message[];
  isTyping?: boolean;
  className?: string;
  compact?: boolean;
}

export function MessageList({ messages, isTyping = false, className, compact = false }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  return (
    <div className={cn('flex-1 overflow-y-auto py-4 bg-white', className)}>
      {messages.map((message, index) => (
        <div
          key={message.id}
          className={
            compact
              ? message.who === 'bot'
                ? 'mb-2'
                : 'mb-1'
              : message.who === 'bot'
                ? 'mb-4'
                : 'mb-2'
          }
        >
          <ChatBubble message={message} />
        </div>
      ))}
      {isTyping && <TypingIndicator />}
      <div ref={messagesEndRef} />
    </div>
  );
}
