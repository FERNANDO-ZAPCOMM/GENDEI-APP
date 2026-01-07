'use client';

import { useMemo } from 'react';
import { MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ProductData } from './types';

interface WhatsAppPreviewProps {
  productData: ProductData;
  className?: string;
}

interface PreviewMessage {
  who: 'customer' | 'bot';
  text: string;
}

export function WhatsAppPreview({ productData, className }: WhatsAppPreviewProps) {
  const previewMessages = useMemo<PreviewMessage[]>(() => {
    const messages: PreviewMessage[] = [];

    if (!productData.name) {
      return [
        { who: 'customer', text: 'Oi, quero saber mais sobre o produto!' },
        { who: 'bot', text: 'Olá! 👋 Ainda estamos configurando as informações do produto. Continue o cadastro para ver a prévia completa!' },
      ];
    }

    messages.push({ who: 'customer', text: `Oi! Quero saber mais sobre ${productData.name}` });

    let greeting = `Olá! 👋 Que bom que você se interessou`;
    if (productData.name) greeting += ` pelo ${productData.name}!`;
    if (productData.mainBenefit) greeting += `\n\n${productData.mainBenefit}`;
    messages.push({ who: 'bot', text: greeting });

    if (productData.price) {
      messages.push({ who: 'customer', text: 'Quanto custa?' });
      const priceText = productData.currency === 'BRL' || !productData.currency
        ? `R$ ${productData.price.toFixed(2).replace('.', ',')}`
        : `${productData.currency} ${productData.price.toFixed(2)}`;
      messages.push({ who: 'bot', text: `O investimento é de ${priceText}. Posso te ajudar a finalizar a compra agora mesmo! 🚀` });
    }

    if (productData.objections && productData.objections.length > 0 && productData.objectionResponses) {
      const firstObjection = productData.objections[0];
      const response = productData.objectionResponses[firstObjection];
      if (response) {
        messages.push({ who: 'customer', text: firstObjection });
        messages.push({ who: 'bot', text: response });
      }
    }

    return messages;
  }, [productData]);

  const hasContent = productData.name || productData.description;
  const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={cn('flex flex-col items-center', className)}>
      {/* iPhone Frame - EXACT website specs: 280x580, border-radius 48px */}
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
              background: '#e5ddd5',
              zIndex: 5,
              borderRadius: '38px 38px 0 0',
            }}
          />

          {/* Chat Area */}
          <div
            style={{
              flex: 1,
              padding: '8px',
              paddingTop: '50px',
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
                  alignSelf: msg.who === 'customer' ? 'flex-start' : 'flex-end',
                }}
              >
                {/* Bubble - customer: white/left, bot: green/right */}
                <div
                  style={{
                    padding: '6px 10px',
                    borderRadius: '8px',
                    width: '180px',
                    background: msg.who === 'customer' ? 'white' : '#dcf8c6',
                    borderTopLeftRadius: msg.who === 'customer' ? '0' : '8px',
                    borderTopRightRadius: msg.who === 'customer' ? '8px' : '0',
                    position: 'relative',
                  }}
                >
                  <p style={{ fontSize: '11px', lineHeight: 1.4, margin: 0, color: '#111', whiteSpace: 'pre-wrap', paddingRight: '40px' }}>
                    {msg.text}
                  </p>
                  <span style={{ position: 'absolute', bottom: '4px', right: '8px', fontSize: '9px', color: '#999' }}>
                    {timeStr}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer info */}
      <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
        <MessageCircle className="w-3 h-3" />
        {hasContent ? (
          <span>Prévia baseada nas informações cadastradas</span>
        ) : (
          <span>Complete o cadastro para ver a prévia</span>
        )}
      </div>
    </div>
  );
}
