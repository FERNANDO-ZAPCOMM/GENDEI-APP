'use client';

import { useMemo } from 'react';
import { MessageCircle } from 'lucide-react';
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
  type?: 'text' | 'location';
}

export function ClinicWhatsAppPreview({ clinicData, className }: ClinicWhatsAppPreviewProps) {
  const previewMessages = useMemo<PreviewMessage[]>(() => {
    const messages: PreviewMessage[] = [];
    const clinicName = clinicData.name || 'Sua Clínica';
    const hasAddress = clinicData.addressData?.latitude && clinicData.addressData?.longitude;

    // Default conversation if no clinic name
    if (!clinicData.name) {
      return [
        { who: 'patient', text: 'Olá, gostaria de agendar uma consulta' },
        { who: 'bot', text: 'Olá! Bem-vindo! Sou o assistente virtual. Preencha os dados da clínica para ver a conversa personalizada.' },
      ];
    }

    // Patient initiates
    messages.push({
      who: 'patient',
      text: 'Olá, gostaria de agendar uma consulta',
    });

    // Bot greeting
    messages.push({
      who: 'bot',
      text: `Olá! Bem-vindo à *${clinicName}*! 👋\n\nSou o assistente virtual e estou aqui para ajudar você a agendar sua consulta.`,
    });

    // Patient asks about availability
    messages.push({
      who: 'patient',
      text: 'Vocês têm horário disponível essa semana?',
    });

    // Bot responds with availability
    let availabilityMsg = 'Temos horários disponíveis sim! 📅\n\n';
    if (clinicData.openingHours) {
      availabilityMsg += `Funcionamos: *${clinicData.openingHours}*\n\n`;
    }
    availabilityMsg += 'Qual dia e horário seria melhor para você?';
    messages.push({
      who: 'bot',
      text: availabilityMsg,
    });

    // Patient confirms
    messages.push({
      who: 'patient',
      text: 'Amanhã às 14h seria ótimo!',
    });

    // Bot confirms appointment
    let confirmMsg = 'Perfeito! ✅\n\nAgendei sua consulta para *amanhã às 14h*.\n\n';
    if (hasAddress) {
      confirmMsg += '📍 Vou enviar nossa localização:';
    } else if (clinicData.address) {
      confirmMsg += `📍 Nosso endereço:\n${clinicData.address}`;
    }
    messages.push({
      who: 'bot',
      text: confirmMsg,
    });

    // Location message if coordinates available
    if (hasAddress) {
      messages.push({
        who: 'bot',
        text: `📍 ${clinicData.addressData?.formatted || clinicData.address || 'Ver localização'}`,
        type: 'location',
      });
    }

    // Final message
    messages.push({
      who: 'bot',
      text: 'Precisa de mais alguma informação? 😊',
    });

    return messages;
  }, [clinicData]);

  const hasContent = clinicData.name;
  const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={cn('flex flex-col items-center', className)}>
      {/* iPhone Frame - 280x580, border-radius 48px */}
      <div
        style={{
          width: '280px',
          height: '580px',
          background: '#1a1a1a',
          borderRadius: '48px',
          padding: '8px',
          border: '8px solid #1a1a1a',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.1), 0 30px 80px rgba(0,0,0,0.2)',
          position: 'relative',
        }}
      >
        {/* Dynamic Island */}
        <div
          style={{
            position: 'absolute',
            top: '18px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '100px',
            height: '30px',
            background: '#000',
            borderRadius: '16px',
            zIndex: 10,
          }}
        />

        {/* Screen */}
        <div
          style={{
            width: '100%',
            height: '100%',
            background: '#e5ddd5',
            borderRadius: '38px',
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
              height: '50px',
              background: '#075e54',
              zIndex: 5,
              borderRadius: '38px 38px 0 0',
            }}
          />

          {/* WhatsApp Header */}
          <div
            style={{
              position: 'absolute',
              top: '50px',
              left: 0,
              right: 0,
              height: '44px',
              background: '#075e54',
              zIndex: 4,
              display: 'flex',
              alignItems: 'center',
              padding: '0 12px',
              gap: '8px',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: '#25d366',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                color: 'white',
                fontWeight: 'bold',
              }}
            >
              {(clinicData.name || 'C').charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: 'white' }}>
                {clinicData.name || 'Sua Clínica'}
              </p>
              <p style={{ margin: 0, fontSize: '9px', color: 'rgba(255,255,255,0.7)' }}>
                online
              </p>
            </div>
          </div>

          {/* Chat Area */}
          <div
            style={{
              flex: 1,
              padding: '8px',
              paddingTop: '100px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c9c9c9' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          >
            {previewMessages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignSelf: msg.who === 'patient' ? 'flex-start' : 'flex-end',
                }}
              >
                {/* Bubble - patient: white/left, bot: green/right */}
                <div
                  style={{
                    padding: msg.type === 'location' ? '4px' : '6px 10px',
                    borderRadius: '8px',
                    maxWidth: '200px',
                    background: msg.who === 'patient' ? 'white' : '#dcf8c6',
                    borderTopLeftRadius: msg.who === 'patient' ? '0' : '8px',
                    borderTopRightRadius: msg.who === 'patient' ? '8px' : '0',
                    position: 'relative',
                  }}
                >
                  {msg.type === 'location' ? (
                    <div>
                      {/* Location preview box */}
                      <div
                        style={{
                          width: '180px',
                          height: '80px',
                          background: 'linear-gradient(135deg, #a8e6cf 0%, #88d8b0 100%)',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: '4px',
                        }}
                      >
                        <span style={{ fontSize: '24px' }}>📍</span>
                      </div>
                      <p style={{ fontSize: '10px', lineHeight: 1.3, margin: '4px 6px', color: '#111' }}>
                        {msg.text.replace('📍 ', '')}
                      </p>
                      <span style={{ position: 'absolute', bottom: '4px', right: '8px', fontSize: '9px', color: '#999' }}>
                        {timeStr}
                      </span>
                    </div>
                  ) : (
                    <>
                      <p
                        style={{
                          fontSize: '10px',
                          lineHeight: 1.4,
                          margin: 0,
                          color: '#111',
                          whiteSpace: 'pre-wrap',
                          paddingRight: '36px'
                        }}
                        dangerouslySetInnerHTML={{
                          __html: msg.text
                            .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
                            .replace(/\n/g, '<br/>')
                        }}
                      />
                      <span style={{ position: 'absolute', bottom: '4px', right: '8px', fontSize: '9px', color: '#999' }}>
                        {timeStr}
                      </span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Input bar */}
          <div
            style={{
              height: '40px',
              background: '#f0f0f0',
              display: 'flex',
              alignItems: 'center',
              padding: '0 8px',
              gap: '8px',
            }}
          >
            <div
              style={{
                flex: 1,
                height: '28px',
                background: 'white',
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                padding: '0 12px',
                fontSize: '10px',
                color: '#999',
              }}
            >
              Digite uma mensagem
            </div>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: '#25d366',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: '12px' }}>🎤</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer info */}
      <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
        <MessageCircle className="w-3 h-3" />
        {hasContent ? (
          <span>Simulacao da conversa com paciente</span>
        ) : (
          <span>Preencha os dados para ver a simulacao</span>
        )}
      </div>
    </div>
  );
}
