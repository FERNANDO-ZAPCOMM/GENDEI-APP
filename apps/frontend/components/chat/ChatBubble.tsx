'use client';

import { cn } from '@/lib/utils';
import type { Message } from './types';

interface ChatBubbleProps {
  message: Message;
  variant?: 'clone' | 'whatsapp';
}

// Format timestamp in São Paulo timezone (America/Sao_Paulo)
function formatTimestamp(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function parsePrompt(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <span key={index} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </span>
      );
    }
    return part;
  });
}

export function ChatBubble({ message, variant = 'clone' }: ChatBubbleProps) {
  const isBot = message.who === 'bot';
  const inferredPrompt =
    /\*\*[^*]+\*\*/.test(message.text) ||
    message.text.trim().endsWith('?');
  const showCategory =
    isBot &&
    message.category &&
    ((message.isPrompt ?? inferredPrompt) === true);

  const bubbleClasses = (() => {
    if (variant === 'whatsapp') {
      return isBot
        ? 'bg-white border border-slate-200 text-slate-900 rounded-bl-none'
        : 'bg-[#DCF8C6] text-slate-900 rounded-br-none';
    }
    // clone
    return isBot
      ? 'bg-slate-100 text-slate-900 rounded-tl-none'
      : 'bg-primary text-primary-foreground rounded-br-none';
  })();

  const bubbleWidthClass = 'w-[420px] max-w-[90%]';

  return (
    <div className={cn('flex items-start', isBot ? 'justify-start' : 'justify-end')}>
      <div className={cn(bubbleWidthClass, 'min-w-[180px] whitespace-pre-wrap')}>
        <div
          className={cn(
            'flex flex-col p-3 rounded-2xl text-sm leading-6',
            bubbleClasses
          )}
        >
          {showCategory && (
            <div className="mb-2">
              <span
                className={cn(
                  'text-xs',
                  isBot ? 'text-slate-500' : 'text-primary-foreground/80'
                )}
              >
                {message.category}
              </span>
            </div>
          )}
          {message.imageUrl && (
            <div className="mb-2 rounded-lg overflow-hidden">
              <img
                src={message.imageUrl}
                alt="Thumbnail preview"
                className="w-full max-w-[200px] h-auto object-cover rounded-lg"
              />
            </div>
          )}
          <div>{parsePrompt(message.text)}</div>
          {message.timestamp && (
            <div className={cn(
              'text-[10px] mt-1 text-right',
              isBot ? 'text-slate-400' : 'text-slate-500'
            )}>
              {formatTimestamp(message.timestamp)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
