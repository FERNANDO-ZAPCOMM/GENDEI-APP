'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CreatorData } from './types';

interface CreatorWhatsAppPreviewProps {
  creatorData: CreatorData;
  className?: string;
}

interface PreviewMessage {
  who: 'customer' | 'bot';
  text: string;
}

export function CreatorWhatsAppPreview({ creatorData, className }: CreatorWhatsAppPreviewProps) {
  const t = useTranslations();

  const previewMessages = useMemo<PreviewMessage[]>(() => {
    const messages: PreviewMessage[] = [];
    const voiceStyle = creatorData.voiceStyle || 'friendly_coach';

    const tempValue = creatorData.leadTemperature ?? 50;
    const leadTemp: 'cold' | 'warm' | 'hot' = tempValue <= 33 ? 'cold' : tempValue >= 67 ? 'hot' : 'warm';
    const salesApproach = leadTemp === 'hot' ? 'direct' : leadTemp === 'cold' ? 'educational' : 'consultative';

    if (!creatorData.displayName) {
      return [
        { who: 'customer', text: t('clone.preview.messages.defaultCustomer') },
        { who: 'bot', text: t('clone.preview.messages.defaultBot') },
      ];
    }

    const niche = creatorData.niche?.toLowerCase() || '';
    const showProductsInGreeting = creatorData.showProductsInGreeting ?? true;
    const productTypes = creatorData.productTypes || [];
    const productLabels: Record<string, string> = {
      ebook: t('clone.productTypes.ebook.title'),
      mentoring: t('clone.productTypes.mentoring.title'),
      community: t('clone.productTypes.community.title'),
    };

    if (leadTemp === 'cold') {
      messages.push({ who: 'customer', text: t('clone.preview.messages.customerCold') });
    } else if (leadTemp === 'hot') {
      messages.push({ who: 'customer', text: t('clone.preview.messages.customerHot') });
    } else {
      messages.push({ who: 'customer', text: t('clone.preview.messages.customerWarm') });
    }

    if (creatorData.welcomeMessage) {
      messages.push({ who: 'bot', text: creatorData.welcomeMessage });
    } else {
      if (voiceStyle === 'friendly_coach') {
        if (leadTemp === 'cold') {
          messages.push({
            who: 'bot',
            text: niche
              ? t('clone.preview.messages.friendlyColdWithNiche', { name: creatorData.displayName, niche })
              : t('clone.preview.messages.friendlyCold', { name: creatorData.displayName })
          });
        } else if (leadTemp === 'hot') {
          messages.push({
            who: 'bot',
            text: t('clone.preview.messages.friendlyHot', { name: creatorData.displayName })
          });
        } else {
          messages.push({
            who: 'bot',
            text: niche
              ? t('clone.preview.messages.friendlyWarmWithNiche', { name: creatorData.displayName, niche })
              : t('clone.preview.messages.friendlyWarm', { name: creatorData.displayName })
          });
        }
      } else if (voiceStyle === 'professional_expert') {
        messages.push({
          who: 'bot',
          text: niche
            ? t('clone.preview.messages.professionalWithNiche', { name: creatorData.displayName, niche })
            : t('clone.preview.messages.professional', { name: creatorData.displayName })
        });
      } else {
        messages.push({
          who: 'bot',
          text: niche
            ? t('clone.preview.messages.formalWithNiche', { name: creatorData.displayName, niche })
            : t('clone.preview.messages.formal', { name: creatorData.displayName })
        });
      }
    }

    if (showProductsInGreeting && productTypes.length > 0 && !creatorData.welcomeMessage) {
      const titles = productTypes.map((type) => productLabels[type]).filter(Boolean).slice(0, 2);
      if (titles.length > 0) {
        const listText = titles.length === 1 ? titles[0] : `${titles[0]} e ${titles[1]}`;
        const productLine = t('clone.preview.messages.greetingProducts', { products: listText });
        const lastBotIndex = [...messages].map((m, idx) => ({ m, idx })).reverse().find((item) => item.m.who === 'bot')?.idx;
        if (lastBotIndex !== undefined) {
          messages[lastBotIndex] = { ...messages[lastBotIndex], text: `${messages[lastBotIndex].text} ${productLine}`.trim() };
        }
      }
    }

    if (salesApproach === 'educational') {
      messages.push({ who: 'bot', text: voiceStyle === 'friendly_coach' ? t('clone.preview.messages.educationalFriendly') : t('clone.preview.messages.educationalProfessional') });
    } else if (salesApproach === 'direct') {
      messages.push({ who: 'bot', text: voiceStyle === 'friendly_coach' ? t('clone.preview.messages.directFriendly') : t('clone.preview.messages.directProfessional') });
    } else {
      messages.push({ who: 'bot', text: voiceStyle === 'friendly_coach' ? t('clone.preview.messages.consultativeFriendly') : t('clone.preview.messages.consultativeProfessional') });
    }

    if (salesApproach === 'consultative') {
      messages.push({ who: 'customer', text: t('clone.preview.messages.customerResponseConsultative') });
    } else {
      messages.push({ who: 'customer', text: t('clone.preview.messages.customerResponseDefault') });
    }

    if (leadTemp === 'hot') {
      messages.push({ who: 'bot', text: voiceStyle === 'friendly_coach' ? t('clone.preview.messages.finalHotFriendly') : t('clone.preview.messages.finalHotProfessional') });
    } else if (leadTemp === 'warm') {
      messages.push({ who: 'bot', text: voiceStyle === 'friendly_coach' ? t('clone.preview.messages.finalWarmFriendly') : t('clone.preview.messages.finalWarmProfessional') });
    } else {
      messages.push({ who: 'bot', text: voiceStyle === 'friendly_coach' ? t('clone.preview.messages.finalColdFriendly') : t('clone.preview.messages.finalColdProfessional') });
    }

    return messages;
  }, [creatorData, t]);

  const hasContent = creatorData.displayName;
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
          <span>{t('clone.preview.previewWithContent')}</span>
        ) : (
          <span>{t('clone.preview.completeSetup')}</span>
        )}
      </div>
    </div>
  );
}
