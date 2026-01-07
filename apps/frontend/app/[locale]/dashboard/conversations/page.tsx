'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Search, Filter, MessageSquare, MessageCircle, Zap, CalendarDays, Eye } from 'lucide-react';
import { format } from 'date-fns';

import { useCreator } from '@/hooks/use-creator';
import { getConversationStateColor } from '@/lib/meta-utils';
import {
  useConversations,
  useConversationStats,
  ConversationState,
  type ConversationFilters,
} from '@/hooks/use-conversations';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TableSkeleton } from '@/components/skeletons/TableSkeleton';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

// Helper to get initials from name
function getInitials(name: string): string {
  if (!name) return '?';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

// Helper to generate consistent color from string
function getColorFromString(str: string): string {
  const colors = [
    'bg-red-100 text-red-700',
    'bg-orange-100 text-orange-700',
    'bg-amber-100 text-amber-700',
    'bg-yellow-100 text-yellow-700',
    'bg-lime-100 text-lime-700',
    'bg-green-100 text-green-700',
    'bg-emerald-100 text-emerald-700',
    'bg-teal-100 text-teal-700',
    'bg-cyan-100 text-cyan-700',
    'bg-sky-100 text-sky-700',
    'bg-blue-100 text-blue-700',
    'bg-indigo-100 text-indigo-700',
    'bg-violet-100 text-violet-700',
    'bg-purple-100 text-purple-700',
    'bg-fuchsia-100 text-fuchsia-700',
    'bg-pink-100 text-pink-700',
    'bg-rose-100 text-rose-700',
  ];

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

function ConversationsPageContent() {
  const t = useTranslations();
  const router = useRouter();
  const { currentCreator: creator } = useCreator();

  const [searchQuery, setSearchQuery] = useState('');
  const [stateFilter, setStateFilter] = useState<ConversationState | 'all'>('all');
  const [takeoverFilter, setTakeoverFilter] = useState<'all' | 'ai' | 'human'>('all');

  const filters = useMemo<ConversationFilters>(() => {
    const f: ConversationFilters = {};
    if (stateFilter !== 'all') f.state = stateFilter as ConversationState;
    if (takeoverFilter === 'ai') f.isHumanTakeover = false;
    if (takeoverFilter === 'human') f.isHumanTakeover = true;
    if (searchQuery) f.search = searchQuery;
    return f;
  }, [stateFilter, takeoverFilter, searchQuery]);

  const { conversations, isLoading } = useConversations(creator?.id || '', filters);
  const { stats } = useConversationStats(creator?.id || '');

  const handleConversationClick = (conversationId: string) => {
    router.push(`/dashboard/conversations/${conversationId}`);
  };

  if (isLoading && !conversations.length) {
    return (
      <div className="space-y-6 page-transition">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">{t('conversations.title')}</h1>
          <p className="text-gray-600 mt-1">{t('conversations.description')}</p>
        </div>
        <TableSkeleton rows={8} columns={5} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6 page-transition sm:h-[calc(100vh-120px)] sm:min-h-0">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">{t('conversations.title')}</h1>
        <p className="text-sm sm:text-base text-gray-600 mt-1">{t('conversations.description')}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600 font-medium">{t('conversations.stats.total')}</p>
                <p className="text-2xl font-bold text-blue-700">{stats?.totalConversations || 0}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-100" style={{ background: 'linear-gradient(to bottom right, #f5fefa, white)' }}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-600 font-medium">{t('conversations.stats.active')}</p>
                <p className="text-2xl font-bold text-emerald-700">{stats?.activeConversations || 0}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <Zap className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-100" style={{ background: 'linear-gradient(to bottom right, #fdfaff, white)' }}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-purple-600 font-medium">{t('conversations.stats.new7days') || 'New (7 days)'}</p>
                <p className="text-2xl font-bold text-purple-700">{stats?.totalConversations || 0}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <CalendarDays className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">{t('conversations.filters.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('conversations.filters.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* State Filter */}
            <Select value={stateFilter} onValueChange={(val) => setStateFilter(val as any)}>
              <SelectTrigger>
                <SelectValue placeholder={t('conversations.filters.state')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('conversations.filters.allStates')}</SelectItem>
                <SelectItem value="novo">{t('conversations.state.novo')}</SelectItem>
                <SelectItem value="qualificado">{t('conversations.state.qualificado')}</SelectItem>
                <SelectItem value="negociando">{t('conversations.state.negociando')}</SelectItem>
                <SelectItem value="fechado">{t('conversations.state.fechado')}</SelectItem>
              </SelectContent>
            </Select>

            {/* Takeover Filter */}
            <Select value={takeoverFilter} onValueChange={(val) => setTakeoverFilter(val as any)}>
              <SelectTrigger>
                <SelectValue placeholder={t('conversations.filters.handler')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('conversations.filters.allHandlers')}</SelectItem>
                <SelectItem value="ai">{t('conversations.handler.ai')}</SelectItem>
                <SelectItem value="human">{t('conversations.handler.human')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Conversations List (fixed height + scroll on desktop, natural flow on mobile) */}
      <Card className="flex flex-col sm:flex-1 sm:min-h-0">
        <CardHeader>
          <CardTitle>{t('conversations.list.title')}</CardTitle>
          <CardDescription>
            {t('conversations.list.description', { count: conversations.length })}
          </CardDescription>
        </CardHeader>
        <CardContent className="sm:flex-1 sm:min-h-0 sm:overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <Eye className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <p className="text-muted-foreground text-sm">{t('conversations.noConversationsFound')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  onClick={() => handleConversationClick(conversation.id)}
                  className="flex items-center justify-between p-3 sm:p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                    {/* Avatar with Initials */}
                    <div className="flex-shrink-0">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center font-semibold text-sm ${getColorFromString(conversation.waUserName || conversation.waUserPhone || conversation.waUserId)}`}>
                        {getInitials(conversation.waUserName || conversation.waUserPhone || conversation.waUserId)}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm mb-1">
                        {conversation.waUserName || conversation.waUserPhone || conversation.waUserId}
                      </p>
                      {conversation.waUserName && conversation.waUserPhone && (
                        <p className="text-xs text-muted-foreground mb-1">{conversation.waUserPhone}</p>
                      )}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge
                          variant="outline"
                          className={`text-xs ${getConversationStateColor(conversation.state)}`}
                        >
                          {t(`conversations.state.${conversation.state}`)}
                        </Badge>
                        {conversation.isHumanTakeover && (
                          <Badge variant="outline" className="text-xs text-blue-600 border-blue-600">
                            {t('conversations.handler.human')}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Timestamp */}
                  <div className="flex-shrink-0 text-right">
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(conversation.lastMessageAt), 'MMM d, HH:mm')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ConversationsPage() {
  return (
    <PermissionGuard permission="canViewConversations">
      <ConversationsPageContent />
    </PermissionGuard>
  );
}
