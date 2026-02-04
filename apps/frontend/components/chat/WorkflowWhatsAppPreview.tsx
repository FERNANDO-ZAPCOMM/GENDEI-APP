'use client';

import { useMemo, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { WorkflowMode } from '@/lib/clinic-types';

interface WorkflowWhatsAppPreviewProps {
  mode: WorkflowMode;
  clinicName?: string;
  topic?: string;
  description?: string;
  welcomeMessage?: string;
  className?: string;
}

interface PreviewMessage {
  who: 'patient' | 'bot';
  text: string;
}

export function WorkflowWhatsAppPreview({
  mode,
  clinicName = 'Sua Clínica',
  topic,
  description,
  welcomeMessage,
  className
}: WorkflowWhatsAppPreviewProps) {
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const previewMessages = useMemo<PreviewMessage[]>(() => {
    const messages: PreviewMessage[] = [];
    const displayName = topic || clinicName;

    if (mode === 'booking') {
      // Booking mode conversation
      messages.push({
        who: 'patient',
        text: 'Oi, tudo bem?',
      });
      messages.push({
        who: 'bot',
        text: `Vou te ajudar a agendar sua consulta. Qual especialidade você procura?`,
      });
      messages.push({
        who: 'patient',
        text: 'Clínico geral',
      });
      messages.push({
        who: 'bot',
        text: '📅 Temos horários disponíveis com Dr. João Silva:\n\n• Segunda, 10/02 às 14:00\n• Terça, 11/02 às 09:30\n• Quarta, 12/02 às 16:00\n\nQual você prefere?',
      });
      messages.push({
        who: 'patient',
        text: 'Segunda às 14h',
      });
      messages.push({
        who: 'bot',
        text: '✅ Perfeito! Agendado para Segunda, 10/02 às 14:00 com Dr. João Silva.\n\n💳 Para confirmar, precisamos de um sinal de R$ 50,00 via PIX.',
      });
    } else {
      // Info mode conversation - uses custom welcome message and topic
      messages.push({
        who: 'patient',
        text: 'Oi, tudo bem?',
      });

      // Use custom welcome message or generate default
      const greeting = welcomeMessage ||
        `Olá! 👋 Bem-vindo! Estou aqui para tirar suas dúvidas sobre ${displayName}. Como posso ajudar?`;
      messages.push({
        who: 'bot',
        text: greeting,
      });

      messages.push({
        who: 'patient',
        text: `Como funciona ${topic ? `o ${topic}` : 'a clínica'} na prática?`,
      });

      // Generate response based on description or default
      if (description && description.length > 50) {
        // Truncate long descriptions for preview
        const shortDesc = description.length > 200
          ? description.substring(0, 200) + '...'
          : description;
        messages.push({
          who: 'bot',
          text: shortDesc,
        });
      } else {
        messages.push({
          who: 'bot',
          text: `${displayName} oferece atendimento especializado com profissionais qualificados. Nosso objetivo é proporcionar o melhor cuidado para você e sua família.`,
        });
      }
    }

    return messages;
  }, [mode, clinicName, topic, description, welcomeMessage]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [previewMessages]);

  const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={cn('flex flex-col items-center', className)}>
      {/* iPhone Frame - ZapComm style */}
      <div
        style={{
          width: '320px',
          height: '640px',
          background: '#2d2d2d',
          borderRadius: '50px',
          padding: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          position: 'relative',
        }}
      >
        {/* Dynamic Island */}
        <div
          style={{
            position: 'absolute',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '110px',
            height: '32px',
            background: '#000',
            borderRadius: '20px',
            zIndex: 10,
          }}
        />

        {/* Screen */}
        <div
          style={{
            width: '100%',
            height: '100%',
            background: '#e8e0d5',
            borderRadius: '40px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
          }}
        >
          {/* Solid overlay behind Dynamic Island */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '55px',
              background: '#e8e0d5',
              zIndex: 5,
              borderRadius: '40px 40px 0 0',
            }}
          />

          {/* Chat Area */}
          <div
            ref={chatContainerRef}
            style={{
              flex: 1,
              padding: '12px',
              paddingTop: '65px',
              paddingBottom: '20px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c9c9c9' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          >
            {previewMessages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: msg.who === 'patient' ? 'flex-start' : 'flex-end',
                }}
              >
                {/* Chat bubble */}
                <div
                  style={{
                    padding: '10px 14px',
                    paddingBottom: '22px',
                    borderRadius: '12px',
                    maxWidth: '240px',
                    background: msg.who === 'patient' ? '#ffffff' : '#d9fdd3',
                    borderTopLeftRadius: msg.who === 'patient' ? '4px' : '12px',
                    borderTopRightRadius: msg.who === 'patient' ? '12px' : '4px',
                    position: 'relative',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                  }}
                >
                  <p
                    style={{
                      fontSize: '13px',
                      lineHeight: 1.45,
                      margin: 0,
                      color: '#1a1a1a',
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {msg.text}
                  </p>
                  <span
                    style={{
                      position: 'absolute',
                      bottom: '6px',
                      right: '10px',
                      fontSize: '11px',
                      color: '#8c8c8c',
                    }}
                  >
                    {timeStr}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
