'use client';

import { useMemo, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { ClinicAddress } from '@/lib/clinic-types';

interface ClinicPreviewData {
  name: string;
  phone?: string;
  email?: string;
  openingHours?: string;
  address?: string;
  addressData?: ClinicAddress;
}

interface ClinicWhatsAppPreviewProps {
  clinicData: ClinicPreviewData;
  className?: string;
}

interface PreviewMessage {
  who: 'patient' | 'bot';
  text: string;
}

// Determine which scenario to show based on filled data
type ConversationScenario = 'empty' | 'name-only' | 'location' | 'hours' | 'contact' | 'complete';

function getScenario(data: ClinicPreviewData): ConversationScenario {
  const hasName = Boolean(data.name?.trim());
  const hasAddress = Boolean(data.addressData?.formatted || data.address?.trim());
  const hasHours = Boolean(data.openingHours?.trim());
  const hasContact = Boolean(data.phone?.trim() || data.email?.trim());

  if (!hasName) return 'empty';
  if (hasAddress && hasHours && hasContact) return 'complete';
  if (hasAddress) return 'location';
  if (hasHours) return 'hours';
  if (hasContact) return 'contact';
  return 'name-only';
}

export function ClinicWhatsAppPreview({ clinicData, className }: ClinicWhatsAppPreviewProps) {
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const previewMessages = useMemo<PreviewMessage[]>(() => {
    const messages: PreviewMessage[] = [];
    const clinicName = clinicData.name || 'Sua Clínica';
    const scenario = getScenario(clinicData);

    // Default conversation if no clinic name
    if (scenario === 'empty') {
      return [
        { who: 'patient', text: 'Olá, gostaria de agendar uma consulta' },
        { who: 'bot', text: 'Olá! Bem-vindo! Sou o assistente virtual. Preencha os dados da clínica para ver a conversa personalizada.' },
      ];
    }

    // Build address string for display
    const addressDisplay = clinicData.addressData?.formatted
      || clinicData.address
      || '';

    const neighborhoodCity = clinicData.addressData
      ? [clinicData.addressData.neighborhood, clinicData.addressData.city].filter(Boolean).join(', ')
      : '';

    // SCENARIO: Location-focused conversation (when address is filled)
    if (scenario === 'location') {
      messages.push({
        who: 'patient',
        text: 'Olá, onde fica a clínica?',
      });
      messages.push({
        who: 'bot',
        text: `Olá! Bem-vindo à ${clinicName}! 😊`,
      });
      messages.push({
        who: 'bot',
        text: `📍 Estamos localizados em:\n${addressDisplay}`,
      });
      if (neighborhoodCity) {
        messages.push({
          who: 'patient',
          text: `Ah, conheço a região de ${neighborhoodCity.split(',')[0]}!`,
        });
        messages.push({
          who: 'bot',
          text: 'Ótimo! Quer que eu verifique os horários disponíveis para você? 🗓️',
        });
      }
      return messages;
    }

    // SCENARIO: Hours-focused conversation (when hours is filled)
    if (scenario === 'hours') {
      messages.push({
        who: 'patient',
        text: 'Qual o horário de funcionamento?',
      });
      messages.push({
        who: 'bot',
        text: `Olá! Bem-vindo à ${clinicName}! 😊`,
      });
      messages.push({
        who: 'bot',
        text: `🕐 Nosso horário de atendimento é:\n${clinicData.openingHours}`,
      });
      messages.push({
        who: 'patient',
        text: 'Perfeito, quero agendar!',
      });
      messages.push({
        who: 'bot',
        text: 'Ótimo! Qual especialidade você procura? 🤔',
      });
      return messages;
    }

    // SCENARIO: Contact-focused conversation (when phone/email is filled)
    if (scenario === 'contact') {
      messages.push({
        who: 'patient',
        text: 'Preciso de mais informações',
      });
      messages.push({
        who: 'bot',
        text: `Olá! Bem-vindo à ${clinicName}! 😊 Como posso ajudar?`,
      });
      messages.push({
        who: 'patient',
        text: 'Vocês têm algum contato direto?',
      });
      const contactInfo: string[] = [];
      if (clinicData.phone) contactInfo.push(`📞 ${clinicData.phone}`);
      if (clinicData.email) contactInfo.push(`📧 ${clinicData.email}`);
      messages.push({
        who: 'bot',
        text: `Claro! Nossos contatos:\n${contactInfo.join('\n')}`,
      });
      messages.push({
        who: 'bot',
        text: 'Mas posso agendar sua consulta agora mesmo! 🚀',
      });
      return messages;
    }

    // SCENARIO: Complete setup - show full conversation
    if (scenario === 'complete') {
      messages.push({
        who: 'patient',
        text: 'Olá, gostaria de agendar uma consulta',
      });
      messages.push({
        who: 'bot',
        text: `Olá! Bem-vindo à ${clinicName}! 🎉`,
      });
      messages.push({
        who: 'patient',
        text: 'Onde fica a clínica?',
      });
      messages.push({
        who: 'bot',
        text: `📍 ${addressDisplay}`,
      });
      messages.push({
        who: 'patient',
        text: 'E o horário?',
      });
      messages.push({
        who: 'bot',
        text: `🕐 ${clinicData.openingHours}`,
      });
      messages.push({
        who: 'patient',
        text: 'Perfeito! Quero agendar',
      });
      messages.push({
        who: 'bot',
        text: 'Ótimo! Verificando horários disponíveis... ✨',
      });
      return messages;
    }

    // SCENARIO: Name-only (default greeting)
    messages.push({
      who: 'patient',
      text: 'Olá, gostaria de agendar uma consulta',
    });
    messages.push({
      who: 'bot',
      text: `Olá! Bem-vindo à ${clinicName}! 🎉 Sou o assistente virtual e estou aqui para ajudar você.`,
    });
    messages.push({
      who: 'bot',
      text: 'Me conta, qual especialidade você procura? 🤔',
    });
    messages.push({
      who: 'patient',
      text: 'Quero agendar para amanhã',
    });
    messages.push({
      who: 'bot',
      text: 'Show! Deixa eu verificar os horários disponíveis! ✨',
    });

    return messages;
  }, [clinicData]);

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
