'use client';

import { useState, useRef } from 'react';
import { Send, Upload, Loader2, Check, X, Sparkles, ChevronDown, Search, Image, FileText, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Step, StepOption, ActivityItem, Suggestion } from './types';

interface StepRendererProps {
  step: Step | null;
  onSubmit: (value: string) => void;
  onFileUpload?: (file: File) => Promise<string>;
  onThumbnailGenerate?: (type: 'pdf' | 'upload' | 'generate', file?: File) => Promise<string>;
  disabled?: boolean;
  isUploading?: boolean;
  productName?: string;
}

// Color mapping for chips
const colorClasses: Record<string, { base: string; hover: string; selected: string }> = {
  default: {
    base: 'border-slate-300 bg-white text-slate-700',
    hover: 'hover:bg-slate-50 hover:border-slate-400',
    selected: 'border-primary bg-primary text-primary-foreground',
  },
  green: {
    base: 'border-emerald-300 bg-emerald-50 text-emerald-700',
    hover: 'hover:bg-emerald-100 hover:border-emerald-400',
    selected: 'border-emerald-500 bg-emerald-500 text-white',
  },
  red: {
    base: 'border-rose-300 bg-rose-50 text-rose-700',
    hover: 'hover:bg-rose-100 hover:border-rose-400',
    selected: 'border-rose-500 bg-rose-500 text-white',
  },
  blue: {
    base: 'border-blue-300 bg-blue-50 text-blue-700',
    hover: 'hover:bg-blue-100 hover:border-blue-400',
    selected: 'border-blue-500 bg-blue-500 text-white',
  },
  purple: {
    base: 'border-purple-300 bg-purple-50 text-purple-700',
    hover: 'hover:bg-purple-100 hover:border-purple-400',
    selected: 'border-purple-500 bg-purple-500 text-white',
  },
  orange: {
    base: 'border-orange-300 bg-orange-50 text-orange-700',
    hover: 'hover:bg-orange-100 hover:border-orange-400',
    selected: 'border-orange-500 bg-orange-500 text-white',
  },
};

// Yes/No Button Component
function YesNoButtons({
  onSelect,
  disabled,
}: {
  onSelect: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-3 justify-center">
      <button
        onClick={() => onSelect(true)}
        disabled={disabled}
        className={cn(
          'flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold border-2 transition-all',
          'border-slate-300 bg-white text-slate-700',
          'hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 hover:shadow-md',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        <Check className="w-4 h-4" />
        Sim
      </button>
      <button
        onClick={() => onSelect(false)}
        disabled={disabled}
        className={cn(
          'flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold border-2 transition-all',
          'border-slate-300 bg-white text-slate-700',
          'hover:border-rose-400 hover:bg-rose-50 hover:text-rose-700 hover:shadow-md',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        <X className="w-4 h-4" />
        Não
      </button>
    </div>
  );
}

// Price Chips Component
function PriceChips({
  priceOptions,
  allowCustom,
  onSelect,
  disabled,
}: {
  priceOptions: number[];
  allowCustom?: boolean;
  onSelect: (price: number) => void;
  disabled?: boolean;
}) {
  const [customPrice, setCustomPrice] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  // Format number with 2 decimal places
  const formatCurrency = (value: string): string => {
    // Remove non-numeric characters
    const numbers = value.replace(/\D/g, '');
    if (!numbers) return '';

    // Convert to cents and format
    const cents = parseInt(numbers, 10);
    const reais = (cents / 100).toFixed(2);
    return reais.replace('.', ',');
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrency(e.target.value);
    setCustomPrice(formatted);
  };

  const handleCustomSubmit = () => {
    const price = parseFloat(customPrice.replace(',', '.'));
    if (!isNaN(price) && price >= 0) {
      onSelect(price);
      setCustomPrice('');
      setShowCustom(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 justify-center">
        {/* Gratuito option */}
        <button
          onClick={() => onSelect(0)}
          disabled={disabled}
          className={cn(
            'min-w-[100px] px-5 py-1.5 rounded-full text-sm font-medium border-2 transition-all',
            'border-emerald-300 bg-emerald-50 text-emerald-700',
            'hover:bg-emerald-100 hover:border-emerald-400 hover:shadow-sm',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          Gratuito
        </button>
        {priceOptions.map((price) => (
          <button
            key={price}
            onClick={() => onSelect(price)}
            disabled={disabled}
            className={cn(
              'min-w-[100px] px-5 py-1.5 rounded-full text-sm font-medium border-2 transition-all',
              'border-slate-300 bg-white text-slate-700',
              'hover:bg-slate-50 hover:border-slate-400 hover:shadow-sm',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            R$ {price}
          </button>
        ))}
        {allowCustom && (
          <button
            onClick={() => setShowCustom(!showCustom)}
            disabled={disabled}
            className={cn(
              'min-w-[100px] px-5 py-1.5 rounded-full text-sm font-medium border-2 transition-all whitespace-nowrap',
              showCustom
                ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800'
                : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-400',
              'disabled:opacity-50'
            )}
          >
            Outro valor
          </button>
        )}
      </div>

      {showCustom && (
        <div className="flex gap-2 justify-center items-center">
          <span className="text-slate-500 font-medium">R$</span>
          <input
            type="text"
            inputMode="numeric"
            value={customPrice}
            onChange={handlePriceChange}
            placeholder="0,00"
            disabled={disabled}
            className={cn(
              'w-28 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-center',
              'focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary'
            )}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCustomSubmit();
              }
            }}
          />
          <Button
            size="sm"
            onClick={handleCustomSubmit}
            disabled={!customPrice.trim() || disabled}
            className="rounded-full h-8 w-8 p-0"
          >
            <Check className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

// Activity Card Component
function ActivityCard({
  activity,
  onResponse,
  disabled,
}: {
  activity: ActivityItem;
  onResponse: (id: string, response: string | boolean) => void;
  disabled?: boolean;
}) {
  const [textValue, setTextValue] = useState('');
  const [responded, setResponded] = useState(false);

  const handleYesNo = (value: boolean) => {
    setResponded(true);
    onResponse(activity.id, value);
  };

  const handleTextSubmit = () => {
    if (textValue.trim()) {
      setResponded(true);
      onResponse(activity.id, textValue.trim());
    }
  };

  if (responded) {
    return (
      <div className="p-4 rounded-xl border-2 border-emerald-200 bg-emerald-50/50">
        <div className="flex items-center gap-2">
          <Check className="w-5 h-5 text-emerald-600" />
          <span className="text-sm font-medium text-emerald-700">{activity.label}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl border-2 border-slate-200 bg-white shadow-sm">
      <p className="text-sm font-medium text-slate-800 mb-3">{activity.label}</p>
      {activity.description && (
        <p className="text-xs text-slate-500 mb-3">{activity.description}</p>
      )}

      {activity.type === 'yesno' ? (
        <div className="flex gap-2">
          <button
            onClick={() => handleYesNo(true)}
            disabled={disabled}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium',
              'border border-emerald-300 bg-emerald-50 text-emerald-700',
              'hover:bg-emerald-100 transition-colors',
              'disabled:opacity-50'
            )}
          >
            <Check className="w-4 h-4" />
            Sim
          </button>
          <button
            onClick={() => handleYesNo(false)}
            disabled={disabled}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium',
              'border border-rose-300 bg-rose-50 text-rose-700',
              'hover:bg-rose-100 transition-colors',
              'disabled:opacity-50'
            )}
          >
            <X className="w-4 h-4" />
            Não
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            type="text"
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            placeholder="Digite sua resposta..."
            disabled={disabled}
            className={cn(
              'flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm',
              'focus:outline-none focus:ring-2 focus:ring-primary/40'
            )}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleTextSubmit();
              }
            }}
          />
          <Button size="sm" onClick={handleTextSubmit} disabled={!textValue.trim() || disabled}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

// Activity Cards Container
function ActivityCards({
  activities,
  onComplete,
  disabled,
  allowCustom = true,
}: {
  activities: ActivityItem[];
  onComplete: (responses: Record<string, string | boolean>) => void;
  disabled?: boolean;
  allowCustom?: boolean;
}) {
  const [responses, setResponses] = useState<Record<string, string | boolean>>({});
  const [customObjection, setCustomObjection] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customAdded, setCustomAdded] = useState(false);

  const handleResponse = (id: string, response: string | boolean) => {
    const newResponses = { ...responses, [id]: response };
    setResponses(newResponses);
  };

  const handleAddCustom = () => {
    if (customObjection.trim()) {
      const newResponses = { ...responses, [`custom:${customObjection.trim()}`]: true };
      setResponses(newResponses);
      setCustomAdded(true);
      setShowCustomInput(false);
    }
  };

  const handleComplete = () => {
    onComplete(responses);
  };

  const allAnswered = Object.keys(responses).length >= activities.length;

  return (
    <div className="space-y-3">
      {activities.map((activity) => (
        <ActivityCard
          key={activity.id}
          activity={activity}
          onResponse={handleResponse}
          disabled={disabled}
        />
      ))}

      {/* Custom objection input */}
      {allowCustom && !customAdded && (
        <div className="p-4 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50">
          {!showCustomInput ? (
            <button
              onClick={() => setShowCustomInput(true)}
              disabled={disabled}
              className="w-full text-sm text-slate-500 hover:text-slate-700 font-medium"
            >
              + Adicionar outra objeção comum
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Qual outra objeção você escuta?</p>
              <input
                type="text"
                value={customObjection}
                onChange={(e) => setCustomObjection(e.target.value)}
                placeholder='Ex: "Já tentei antes e não funcionou"'
                disabled={disabled}
                className={cn(
                  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm',
                  'focus:outline-none focus:ring-2 focus:ring-primary/40'
                )}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustom();
                  }
                }}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleAddCustom}
                  disabled={!customObjection.trim() || disabled}
                >
                  Adicionar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowCustomInput(false);
                    setCustomObjection('');
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {customAdded && (
        <div className="p-4 rounded-xl border-2 border-emerald-200 bg-emerald-50/50">
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-700">&ldquo;{customObjection}&rdquo; adicionada</span>
          </div>
        </div>
      )}

      {/* Continue button */}
      {allAnswered && (
        <div className="pt-2">
          <Button onClick={handleComplete} className="w-full" disabled={disabled}>
            Continuar
          </Button>
        </div>
      )}
    </div>
  );
}

// AI Suggestions Component with horizontal scroll
function SuggestionsPanel({
  suggestions,
  allowCustom,
  onSelect,
  disabled,
  horizontal = false,
}: {
  suggestions: Suggestion[];
  allowCustom?: boolean;
  onSelect: (text: string, isAI?: boolean) => void;
  disabled?: boolean;
  horizontal?: boolean;
}) {
  const [customText, setCustomText] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Horizontal scrollable suggestions
  if (horizontal && suggestions.length > 0) {
    return (
      <div className="space-y-3 -mx-4">
        {/* Horizontal scroll container - extended margins */}
        <div
          ref={scrollContainerRef}
          className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide px-4"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {suggestions.map((suggestion) => {
            const isExpanded = expandedId === suggestion.id;
            const isLong = suggestion.text.length > 150;

            return (
              <div
                key={suggestion.id}
                className={cn(
                  'flex-shrink-0 p-3 rounded-xl border-2 text-left transition-all snap-start',
                  isExpanded ? 'w-[320px]' : 'w-[260px]',
                  suggestion.isAI
                    ? 'border-purple-200 bg-white'
                    : 'border-slate-200 bg-white',
                  'hover:shadow-md hover:border-purple-300'
                )}
              >
                <div className="flex items-start gap-2">
                  {suggestion.isAI && (
                    <div className="shrink-0 p-1 rounded-md bg-purple-100">
                      <Sparkles className="w-3 h-3 text-purple-600" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className={cn(
                      'text-xs text-slate-700 leading-relaxed',
                      !isExpanded && isLong && 'line-clamp-3'
                    )}>
                      {suggestion.text}
                    </p>
                    <div className="flex gap-2 mt-2">
                      {isLong && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedId(isExpanded ? null : suggestion.id);
                          }}
                          className="text-[10px] text-purple-600 hover:underline"
                        >
                          {isExpanded ? 'Ver menos' : 'Ver tudo'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onSelect(suggestion.text, suggestion.isAI)}
                        disabled={disabled}
                        className="text-[10px] font-medium text-purple-600 hover:underline disabled:opacity-50"
                      >
                        Usar esta
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Scroll indicators */}
        {suggestions.length > 1 && (
          <div className="flex justify-center gap-1.5 px-4">
            {suggestions.map((_, index) => (
              <div
                key={index}
                className="w-1.5 h-1.5 rounded-full bg-slate-300"
              />
            ))}
          </div>
        )}

        {/* Custom input option - buttons side by side */}
        {allowCustom && (
          <div className="px-4">
            {!showCustom ? (
              <button
                onClick={() => setShowCustom(true)}
                disabled={disabled}
                className={cn(
                  'w-full p-2.5 rounded-xl border-2 border-dashed text-center text-xs font-medium transition-all',
                  'border-slate-300 text-slate-500',
                  'hover:border-slate-400 hover:text-slate-600'
                )}
              >
                + Escrever minha própria resposta
              </button>
            ) : (
              <div className="space-y-2">
                <textarea
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder="Escreva sua resposta personalizada..."
                  disabled={disabled}
                  rows={2}
                  className={cn(
                    'w-full rounded-xl border border-slate-300 px-3 py-2 text-xs resize-none bg-white',
                    'focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary'
                  )}
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowCustom(false);
                      setCustomText('');
                    }}
                    className="text-xs h-8 px-3"
                  >
                    Fechar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (customText.trim()) {
                        onSelect(customText.trim(), false);
                        setCustomText('');
                        setShowCustom(false);
                      }
                    }}
                    disabled={!customText.trim() || disabled}
                    className="text-xs h-8 px-3"
                  >
                    Usar esta
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Vertical layout (default)
  return (
    <div className="space-y-3">
      {suggestions.map((suggestion) => (
        <button
          key={suggestion.id}
          onClick={() => onSelect(suggestion.text, suggestion.isAI)}
          disabled={disabled}
          className={cn(
            'w-full p-4 rounded-xl border-2 text-left transition-all',
            suggestion.isAI
              ? 'border-purple-200 bg-white'
              : 'border-slate-200 bg-white',
            'hover:shadow-md hover:border-purple-300',
            'disabled:opacity-50'
          )}
        >
          <div className="flex items-start gap-3">
            {suggestion.isAI && (
              <div className="shrink-0 p-1.5 rounded-lg bg-purple-100">
                <Sparkles className="w-4 h-4 text-purple-600" />
              </div>
            )}
            <p className="text-sm text-slate-700 leading-relaxed">{suggestion.text}</p>
          </div>
        </button>
      ))}

      {allowCustom && (
        <>
          <button
            onClick={() => setShowCustom(!showCustom)}
            disabled={disabled}
            className={cn(
              'w-full p-3 rounded-xl border-2 border-dashed text-center text-sm font-medium transition-all',
              showCustom
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-slate-300 text-slate-500',
              'hover:border-slate-400 hover:text-slate-600'
            )}
          >
            {showCustom ? 'Fechar' : '+ Escrever minha própria resposta'}
          </button>

          {showCustom && (
            <div className="space-y-2">
              <textarea
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Escreva sua resposta personalizada..."
                disabled={disabled}
                rows={3}
                className={cn(
                  'w-full rounded-xl border border-slate-300 px-4 py-3 text-sm resize-none bg-white',
                  'focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary'
                )}
              />
              <Button
                onClick={() => {
                  if (customText.trim()) {
                    onSelect(customText.trim(), false);
                    setCustomText('');
                    setShowCustom(false);
                  }
                }}
                disabled={!customText.trim() || disabled}
                className="w-full"
              >
                Usar esta resposta
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Searchable Dropdown Component
function SearchableDropdown({
  options,
  placeholder,
  onSelect,
  disabled,
}: {
  options: StepOption[];
  placeholder?: string;
  onSelect: (value: string) => void;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 text-left',
          isOpen ? 'border-primary' : 'border-slate-200',
          'hover:border-slate-300 transition-colors',
          'disabled:opacity-50'
        )}
      >
        <span className="text-sm text-slate-500">{placeholder || 'Selecione uma opção'}</span>
        <ChevronDown
          className={cn('w-5 h-5 text-slate-400 transition-transform', isOpen && 'rotate-180')}
        />
      </button>

      {isOpen && (
        <div className="absolute z-10 w-full mt-2 bg-white rounded-xl border-2 border-slate-200 shadow-lg overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <p className="p-3 text-sm text-slate-500 text-center">Nenhum resultado encontrado</p>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    onSelect(option.value);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                  className="w-full px-4 py-3 text-left text-sm hover:bg-slate-50 transition-colors flex items-center gap-2"
                >
                  {option.emoji && <span>{option.emoji}</span>}
                  <span>{option.label}</span>
                  {option.description && (
                    <span className="text-xs text-slate-400 ml-auto">{option.description}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Thumbnail Selector Component
function ThumbnailSelector({
  pdfCoverUrl,
  onSelect,
  onUpload,
  disabled,
  isUploading,
}: {
  pdfCoverUrl?: string;
  onSelect: (type: 'pdf' | 'upload' | 'generate') => void;
  onUpload: (file: File) => void;
  disabled?: boolean;
  isUploading?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedType, setSelectedType] = useState<'pdf' | 'upload' | 'generate' | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
  };

  // PDF first page is always the primary/first option
  const options = [
    {
      id: 'pdf' as const,
      icon: FileText,
      title: 'Usar capa do PDF',
      description: 'Extrair primeira página do seu ebook',
      preview: pdfCoverUrl,
      recommended: true,
    },
    {
      id: 'upload' as const,
      icon: Image,
      title: 'Fazer upload',
      description: 'Enviar uma imagem personalizada',
    },
    {
      id: 'generate' as const,
      icon: Wand2,
      title: 'Gerar automaticamente',
      description: 'Criar imagem com o título do produto',
    },
  ];

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled || isUploading}
      />

      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide">
        {options.map((option) => {
          const Icon = option.icon;
          const isSelected = selectedType === option.id;

          return (
            <button
              key={option.id}
              onClick={() => {
                setSelectedType(option.id);
                if (option.id === 'upload') {
                  fileInputRef.current?.click();
                } else {
                  onSelect(option.id);
                }
              }}
              disabled={disabled || isUploading}
              className={cn(
                'flex-shrink-0 w-[200px] p-4 rounded-xl border-2 text-left transition-all snap-start',
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-slate-200 bg-white hover:border-slate-300',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {option.preview ? (
                <div className="mb-3 rounded-lg overflow-hidden bg-slate-100 aspect-square">
                  <img
                    src={option.preview}
                    alt="PDF cover preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="mb-3 w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center">
                  <Icon className="w-6 h-6 text-slate-600" />
                </div>
              )}
              <p className="text-sm font-medium text-slate-800">{option.title}</p>
              <p className="text-xs text-slate-500 mt-1">{option.description}</p>
            </button>
          );
        })}
      </div>

      {isUploading && (
        <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Processando imagem...
        </div>
      )}
    </div>
  );
}

// Main StepRenderer Component
export function StepRenderer({
  step,
  onSubmit,
  onFileUpload,
  onThumbnailGenerate,
  disabled = false,
  isUploading = false,
  productName,
}: StepRendererProps) {
  const [textValue, setTextValue] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [thumbnailLoading, setThumbnailLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!step) return null;

  const handleTextSubmit = () => {
    if (!textValue.trim()) return;
    onSubmit(textValue.trim());
    setTextValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTextSubmit();
    }
  };

  const handleOptionSelect = (value: string) => {
    if (step.type === 'multiselect') {
      const newSelected = selectedOptions.includes(value)
        ? selectedOptions.filter((v) => v !== value)
        : [...selectedOptions, value];
      setSelectedOptions(newSelected);
    } else {
      onSubmit(value);
    }
  };

  const handleMultiselectSubmit = () => {
    if (selectedOptions.length === 0) return;
    onSubmit(selectedOptions.join(', '));
    setSelectedOptions([]);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onFileUpload) return;

    try {
      const url = await onFileUpload(file);
      onSubmit(`${file.name}|${url}`);
    } catch (error) {
      console.error('File upload error:', error);
    }
  };

  // Yes/No step
  if (step.type === 'yesno') {
    return (
      <div className="p-4 border-t bg-white">
        <YesNoButtons onSelect={(value) => onSubmit(value ? 'sim' : 'não')} disabled={disabled} />
      </div>
    );
  }

  // Price chips step
  if (step.type === 'price-chips') {
    return (
      <div className="p-4 border-t bg-white">
        <PriceChips
          priceOptions={step.priceOptions || [47, 97, 197]}
          allowCustom={step.allowCustom !== false}
          onSelect={(price) => onSubmit(price.toString())}
          disabled={disabled}
        />
      </div>
    );
  }

  // Activity cards step
  if (step.type === 'activity-cards' && step.activities) {
    return (
      <div className="p-4 border-t bg-white max-h-80 overflow-y-auto">
        <ActivityCards
          activities={step.activities}
          onComplete={(responses) => onSubmit(JSON.stringify(responses))}
          disabled={disabled}
        />
      </div>
    );
  }

  // Suggestions step
  if (step.type === 'suggestions' && step.suggestions) {
    return (
      <div className={cn(
        'p-4 border-t bg-white',
        !step.horizontal && 'max-h-80 overflow-y-auto'
      )}>
        <SuggestionsPanel
          suggestions={step.suggestions}
          allowCustom={step.allowCustom !== false}
          onSelect={(text) => onSubmit(text)}
          disabled={disabled}
          horizontal={step.horizontal}
        />
      </div>
    );
  }

  // Dropdown step
  if (step.type === 'dropdown' && step.options) {
    return (
      <div className="p-4 border-t bg-white">
        <SearchableDropdown
          options={step.options}
          placeholder={step.placeholder}
          onSelect={onSubmit}
          disabled={disabled}
        />
      </div>
    );
  }

  // Thumbnail step
  if (step.type === 'thumbnail') {
    const handleThumbnailSelect = async (type: 'pdf' | 'upload' | 'generate') => {
      if (!onThumbnailGenerate) {
        // Fallback: just submit the type
        onSubmit(`thumbnail:${type}`);
        return;
      }

      setThumbnailLoading(true);
      try {
        const url = await onThumbnailGenerate(type);
        onSubmit(`thumbnail:${type}|${url}`);
      } catch (error) {
        console.error('Thumbnail generation error:', error);
        onSubmit(`thumbnail:${type}|error`);
      } finally {
        setThumbnailLoading(false);
      }
    };

    const handleThumbnailUpload = async (file: File) => {
      if (!onThumbnailGenerate) return;

      setThumbnailLoading(true);
      try {
        const url = await onThumbnailGenerate('upload', file);
        onSubmit(`thumbnail:upload|${url}`);
      } catch (error) {
        console.error('Thumbnail upload error:', error);
      } finally {
        setThumbnailLoading(false);
      }
    };

    return (
      <div className="p-4 border-t bg-white">
        <ThumbnailSelector
          pdfCoverUrl={step.pdfCoverUrl}
          onSelect={handleThumbnailSelect}
          onUpload={handleThumbnailUpload}
          disabled={disabled}
          isUploading={thumbnailLoading}
        />
      </div>
    );
  }

  // Text input
  if (step.type === 'text' || step.type === 'textarea' || step.type === 'price') {
    const isTextarea = step.type === 'textarea';
    const isPrice = step.type === 'price';

    return (
      <div className="flex gap-2 items-end p-3 border-t bg-white">
        {isPrice && <span className="text-slate-500 py-2.5 pl-1">R$</span>}
        {isTextarea ? (
          <textarea
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={step.placeholder}
            disabled={disabled}
            rows={3}
            className={cn(
              'flex-1 resize-none rounded-xl border border-slate-300 px-4 py-2.5 text-sm',
              'focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary',
              'disabled:opacity-50'
            )}
          />
        ) : (
          <input
            type={isPrice ? 'number' : 'text'}
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={step.placeholder}
            disabled={disabled}
            step={isPrice ? '0.01' : undefined}
            min={isPrice ? '0' : undefined}
            className={cn(
              'flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm h-11',
              'focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary',
              'disabled:opacity-50'
            )}
          />
        )}
        <Button
          type="button"
          onClick={handleTextSubmit}
          disabled={!textValue.trim() || disabled}
          size="icon"
          className="rounded-full h-10 w-10 shrink-0"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  // Select options (single or multi)
  if (step.type === 'select' || step.type === 'multiselect') {
    return (
      <div className="p-3 border-t bg-white space-y-3">
        <div className="flex flex-wrap gap-2 justify-center">
          {step.options?.map((option) => {
            const isSelected = selectedOptions.includes(option.value);
            const color = option.color || 'default';
            const colorClass = colorClasses[color];

            // Detect yes/no variants for default coloring
            const isYes =
              option.value.toLowerCase() === 'sim' || option.value.toLowerCase() === 'yes';
            const isNo =
              option.value.toLowerCase() === 'não' || option.value.toLowerCase() === 'no';

            const baseColor =
              color === 'default' && isYes
                ? colorClasses.green
                : color === 'default' && isNo
                ? colorClasses.red
                : colorClass;

            return (
              <button
                key={option.value}
                onClick={() => handleOptionSelect(option.value)}
                disabled={disabled}
                className={cn(
                  'px-4 py-2 rounded-full text-sm font-medium border-2 transition-all',
                  'hover:shadow-sm disabled:opacity-50',
                  step.type === 'multiselect' && isSelected ? baseColor.selected : baseColor.base,
                  !(step.type === 'multiselect' && isSelected) && baseColor.hover
                )}
              >
                {option.emoji && <span className="mr-1.5">{option.emoji}</span>}
                {option.label}
              </button>
            );
          })}
        </div>
        {step.type === 'multiselect' && (
          <div className="flex justify-center">
            <Button
              onClick={handleMultiselectSubmit}
              disabled={selectedOptions.length === 0 || disabled}
              size="sm"
            >
              Confirmar seleção
            </Button>
          </div>
        )}
      </div>
    );
  }

  // File upload
  if (step.type === 'file-upload') {
    return (
      <div className="p-3 border-t bg-white">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileChange}
          className="hidden"
          disabled={disabled || isUploading}
        />
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploading}
          variant="outline"
          className="w-full h-20 border-dashed border-2 hover:bg-slate-50"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Enviando arquivo...
            </>
          ) : (
            <>
              <Upload className="w-5 h-5 mr-2" />
              {step.placeholder || 'Clique para enviar um arquivo PDF'}
            </>
          )}
        </Button>
      </div>
    );
  }

  return null;
}
