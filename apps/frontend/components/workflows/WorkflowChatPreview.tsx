'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Workflow, Product, Creator } from '@/lib/types';

interface WorkflowChatPreviewProps {
  workflow: Workflow;
  creator?: Creator | null;
  products?: Product[];
  className?: string;
}

interface PreviewMessage {
  who: 'customer' | 'bot';
  text: string;
}

// Message animation delays in ms (matching website)
const MESSAGE_DELAYS = [500, 1500, 2500, 4000, 5000, 6000, 7500, 8500];
const TOTAL_ANIMATION_TIME = 12000;

export function WorkflowChatPreview({ workflow, creator, products, className }: WorkflowChatPreviewProps) {
  const chatRef = useRef<HTMLDivElement>(null);
  const [animationKey, setAnimationKey] = useState(0);

  const creatorName = creator?.profile?.displayName || creator?.name || 'Bot';
  const creatorNiche = creator?.profile?.niche || '';

  const freeProduct = products?.find(p => p.price === 0 && (p.active || p.isActive));
  const paidProduct = products?.find(p => p.price > 0 && (p.active || p.isActive));

  const formatPrice = (price: number) => `R$ ${price.toFixed(2).replace('.', ',')}`;

  const previewMessages = useMemo<PreviewMessage[]>(() => {
    const messages: PreviewMessage[] = [];
    const nicheText = creatorNiche ? `, especialista em ${creatorNiche}` : '';
    const mainProduct = paidProduct || freeProduct;
    const productTitle = mainProduct?.title || 'meu produto';
    const productPrice = mainProduct?.price || 0;

    messages.push({ who: 'customer', text: 'Oi, tudo bem?' });
    messages.push({ who: 'bot', text: `Ola! Sou ${creatorName}${nicheText}. 👋\n\nComo posso te ajudar?` });
    messages.push({ who: 'customer', text: `Quero saber mais sobre ${productTitle}` });
    messages.push({ who: 'bot', text: `Claro! 📚 "${productTitle}" vai te ajudar muito!\n\nQuer saber mais?` });
    messages.push({ who: 'customer', text: 'Quanto custa?' });

    if (productPrice > 0) {
      messages.push({ who: 'bot', text: `O investimento e ${formatPrice(productPrice)}! 💰\n\nPosso gerar o PIX?` });
    } else {
      messages.push({ who: 'bot', text: `🎁 E totalmente GRATUITO!\n\nMe passa seu email!` });
    }

    messages.push({ who: 'customer', text: 'Sim, quero!' });
    messages.push({ who: 'bot', text: `Perfeito! 🚀 Ja estou gerando!` });

    return messages;
  }, [creatorName, creatorNiche, freeProduct, paidProduct]);

  const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // Auto-scroll
  useEffect(() => {
    const scrollTimers = MESSAGE_DELAYS.slice(4).map((delay) => {
      return setTimeout(() => {
        if (chatRef.current) {
          chatRef.current.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
        }
      }, delay + 300);
    });
    return () => scrollTimers.forEach(timer => clearTimeout(timer));
  }, [animationKey]);

  // Loop reset
  useEffect(() => {
    const loopTimer = setTimeout(() => {
      if (chatRef.current) {
        chatRef.current.scrollTo({ top: 0, behavior: 'instant' });
      }
      setAnimationKey(prev => prev + 1);
    }, TOTAL_ANIMATION_TIME);
    return () => clearTimeout(loopTimer);
  }, [animationKey]);

  return (
    <div className={cn('flex flex-col items-center', className)}>
      {/* iPhone Frame - EXACT website specs: 280x580, border-radius 48px */}
      <div
        className="relative"
        style={{
          width: '280px',
          height: '580px',
          background: '#1a1a1a',
          borderRadius: '48px',
          padding: '8px',
          border: '8px solid #1a1a1a',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.1), 0 30px 80px rgba(0,0,0,0.2)',
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
            ref={chatRef}
            key={animationKey}
            style={{
              flex: 1,
              padding: '8px',
              paddingTop: '50px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              scrollBehavior: 'smooth',
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c9c9c9' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          >
            {previewMessages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignSelf: msg.who === 'customer' ? 'flex-start' : 'flex-end',
                  opacity: 0,
                  transform: 'translateY(10px)',
                  animation: 'messageAppear 0.3s ease forwards',
                  animationDelay: `${MESSAGE_DELAYS[idx] || MESSAGE_DELAYS[MESSAGE_DELAYS.length - 1]}ms`,
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

      {/* Footer */}
      <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
        <MessageCircle className="w-3 h-3" />
        <span>Simulacao da conversa</span>
      </div>

      {/* CSS Animation */}
      <style jsx>{`
        @keyframes messageAppear {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
