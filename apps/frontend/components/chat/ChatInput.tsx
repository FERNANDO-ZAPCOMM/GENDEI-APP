'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  placeholder?: string;
  onSend: (value: string) => void;
  disabled?: boolean;
}

export function ChatInput({
  placeholder = 'Digite sua mensagem...',
  onSend,
  disabled = false,
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (!value.trim() || disabled) return;
    onSend(value.trim());
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  return (
    <div className="flex gap-2 items-end p-3 border-t bg-white">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleTextareaChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className={cn(
          'flex-1 resize-none rounded-xl border border-slate-300 px-4 py-2.5 text-sm',
          'focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'min-h-[44px] max-h-[120px]'
        )}
      />
      <Button
        type="button"
        onClick={handleSend}
        disabled={!value.trim() || disabled}
        size="icon"
        className="rounded-full h-10 w-10 shrink-0"
      >
        <Send className="w-4 h-4" />
      </Button>
    </div>
  );
}
