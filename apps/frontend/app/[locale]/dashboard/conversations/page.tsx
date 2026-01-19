'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Search, MessageCircle, Zap, CalendarDays, Eye, MoreVertical, Archive, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { useClinic } from '@/hooks/use-clinic';
import { useProfessionals } from '@/hooks/use-professionals';
import { getSpecialtyName } from '@/lib/specialties';
import { getConversationStateColor } from '@/lib/meta-utils';
import {
  useConversations,
  useConversationStats,
  useArchiveConversation,
  useDeleteConversation,
  ConversationState,
  type ConversationFilters,
  type ConversationDocument,
} from '@/hooks/use-conversations';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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

  // Handle undefined or null input
  if (!str) return colors[0];

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

function ConversationsPageContent() {
  const t = useTranslations();
  const router = useRouter();
  const { currentClinic: clinic } = useClinic();

  const [searchQuery, setSearchQuery] = useState('');
  const [stateFilter, setStateFilter] = useState<ConversationState | 'all'>('all');
  const [takeoverFilter, setTakeoverFilter] = useState<'all' | 'ai' | 'human'>('all');
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string | null>(null);
  const [conversationToDelete, setConversationToDelete] = useState<ConversationDocument | null>(null);

  const archiveMutation = useArchiveConversation();
  const deleteMutation = useDeleteConversation();

  const { data: professionals } = useProfessionals(clinic?.id || '');
  const activeProfessionals = useMemo(
    () => professionals.filter((p) => p.active),
    [professionals]
  );

  const filters = useMemo<ConversationFilters>(() => {
    const f: ConversationFilters = {};
    if (stateFilter !== 'all') f.state = stateFilter as ConversationState;
    if (takeoverFilter === 'ai') f.isHumanTakeover = false;
    if (takeoverFilter === 'human') f.isHumanTakeover = true;
    if (searchQuery) f.search = searchQuery;
    if (selectedProfessionalId) f.professionalId = selectedProfessionalId;
    return f;
  }, [stateFilter, takeoverFilter, searchQuery, selectedProfessionalId]);

  const { conversations, isLoading } = useConversations(clinic?.id || '', filters);
  const { stats } = useConversationStats(clinic?.id || '');

  const handleProfessionalSelect = (professionalId: string) => {
    setSelectedProfessionalId((prev) => (prev === professionalId ? null : professionalId));
  };

  const handleConversationClick = (conversationId: string) => {
    router.push(`/dashboard/conversations/${conversationId}`);
  };

  const handleArchive = async (conversation: ConversationDocument, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!clinic?.id) return;

    try {
      await archiveMutation.mutateAsync({
        clinicId: clinic.id,
        conversationId: conversation.id,
      });
      toast.success('Conversa arquivada');
    } catch (error) {
      toast.error('Erro ao arquivar conversa');
    }
  };

  const handleDelete = async () => {
    if (!clinic?.id || !conversationToDelete) return;

    try {
      await deleteMutation.mutateAsync({
        clinicId: clinic.id,
        conversationId: conversationToDelete.id,
      });
      toast.success('Conversa excluída');
      setConversationToDelete(null);
    } catch (error) {
      toast.error('Erro ao excluir conversa');
    }
  };

  if (isLoading && !conversations.length) {
    return (
      <div className="space-y-6 page-transition">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('conversations.title')}</h1>
          <p className="text-gray-600 mt-1">{t('conversations.description')}</p>
        </div>
        <TableSkeleton rows={8} columns={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6 page-transition">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-2xl font-semibold text-gray-900">{t('conversations.title')}</h1>
        <p className="text-sm sm:text-base text-gray-600 mt-1">{t('conversations.description')}</p>
      </div>

      {/* Stats Cards Row - Desktop */}
      <div className="hidden lg:grid grid-cols-3 gap-6">
        <div className="col-span-2 grid grid-cols-2 gap-6">
          <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-600 font-medium">{t('conversations.stats.total')}</p>
                  <p className="text-2xl font-bold text-blue-700">{stats?.totalConversations || 0}</p>
                </div>
                <MessageCircle className="w-5 h-5 text-blue-600" />
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
                <Zap className="w-5 h-5 text-emerald-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-purple-100" style={{ background: 'linear-gradient(to bottom right, #fdfaff, white)' }}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-purple-600 font-medium">{t('conversations.stats.new7days') || 'Ultimos 7 dias'}</p>
                <p className="text-2xl font-bold text-purple-700">{stats?.totalConversations || 0}</p>
              </div>
              <CalendarDays className="w-5 h-5 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mobile Stats Cards */}
      <div className="lg:hidden grid grid-cols-3 gap-3">
        <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-xs text-blue-600 font-medium">Total</p>
              <p className="text-2xl font-bold text-blue-700">{stats?.totalConversations || 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-100" style={{ background: 'linear-gradient(to bottom right, #f5fefa, white)' }}>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-xs text-emerald-600 font-medium">Ativas</p>
              <p className="text-2xl font-bold text-emerald-700">{stats?.activeConversations || 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-100" style={{ background: 'linear-gradient(to bottom right, #fdfaff, white)' }}>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-xs text-purple-600 font-medium">7 dias</p>
              <p className="text-2xl font-bold text-purple-700">{stats?.totalConversations || 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Two Column Layout - Conversations List + Professional Filter */}
      <div className="hidden lg:grid grid-cols-3 gap-6">
        {/* Conversations List spans 2 columns */}
        <Card className="col-span-2 h-[calc(100vh-320px)] flex flex-col">
          <CardHeader className="pb-3 flex-shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">{t('conversations.list.title')}</CardTitle>
                <CardDescription>
                  {t('conversations.list.description', { count: conversations.length })}
                </CardDescription>
              </div>
              {/* Search and Filters */}
              <div className="flex items-center gap-2">
                <div className="relative w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={stateFilter} onValueChange={(val) => setStateFilter(val as any)}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="novo">{t('conversations.state.novo')}</SelectItem>
                    <SelectItem value="qualificado">{t('conversations.state.qualificado')}</SelectItem>
                    <SelectItem value="negociando">{t('conversations.state.negociando')}</SelectItem>
                    <SelectItem value="fechado">{t('conversations.state.fechado')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="space-y-2">
                <div className="h-16 bg-muted/50 rounded-lg animate-pulse" />
                <div className="h-16 bg-muted/50 rounded-lg animate-pulse" />
                <div className="h-16 bg-muted/50 rounded-lg animate-pulse" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                  <Eye className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <p className="text-muted-foreground text-sm">
                  {searchQuery || selectedProfessionalId || stateFilter !== 'all'
                    ? 'Nenhuma conversa encontrada'
                    : 'Conversas aparecerao aqui'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {conversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    onClick={() => handleConversationClick(conversation.id)}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-shrink-0">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center font-semibold text-sm ${getColorFromString(conversation.waUserName || conversation.waUserPhone || conversation.waUserId)}`}>
                          {getInitials(conversation.waUserName || conversation.waUserPhone || conversation.waUserId)}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {conversation.waUserName || conversation.waUserPhone || conversation.waUserId}
                        </p>
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
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
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(conversation.lastMessageAt), 'dd/MM HH:mm')}
                      </p>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => handleArchive(conversation, e)}>
                            <Archive className="h-4 w-4 mr-2" />
                            Arquivar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setConversationToDelete(conversation);
                            }}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Professional Filter */}
        <Card className="h-[calc(100vh-320px)] flex flex-col">
          <CardHeader className="pb-3 flex-shrink-0">
            <CardTitle className="text-base">Por Profissional</CardTitle>
            <CardDescription>
              {selectedProfessionalId
                ? 'Clique para limpar filtro'
                : 'Selecione para filtrar'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 flex-1 overflow-y-auto">
            {activeProfessionals.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-muted-foreground text-center">
                  Nenhum profissional ativo
                </p>
              </div>
            ) : (
              activeProfessionals.map((professional) => (
                <div
                  key={professional.id}
                  onClick={() => handleProfessionalSelect(professional.id)}
                  className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                    selectedProfessionalId === professional.id
                      ? 'bg-indigo-100 border-2 border-indigo-500'
                      : 'hover:bg-muted/50 border-2 border-transparent'
                  }`}
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={professional.photoUrl} alt={professional.name} />
                    <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs">
                      {getInitials(professional.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{professional.name}</p>
                    {professional.specialty && (
                      <p className="text-xs text-muted-foreground truncate">
                        {getSpecialtyName(professional.specialty)}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Mobile: Conversations List Card */}
      <div className="lg:hidden">
        <Card className="h-[calc(100vh-280px)] flex flex-col">
          <CardHeader className="pb-3 flex-shrink-0">
            <div className="flex flex-col gap-3">
              <div>
                <CardTitle className="text-base">{t('conversations.list.title')}</CardTitle>
                <CardDescription>
                  {t('conversations.list.description', { count: conversations.length })}
                </CardDescription>
              </div>
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="space-y-2">
                <div className="h-16 bg-muted/50 rounded-lg animate-pulse" />
                <div className="h-16 bg-muted/50 rounded-lg animate-pulse" />
                <div className="h-16 bg-muted/50 rounded-lg animate-pulse" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                  <Eye className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <p className="text-muted-foreground text-sm">
                  {searchQuery || stateFilter !== 'all'
                    ? 'Nenhuma conversa encontrada'
                    : 'Conversas aparecerao aqui'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {conversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    onClick={() => handleConversationClick(conversation.id)}
                    className="border rounded-lg p-3 bg-white cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0 ${getColorFromString(conversation.waUserName || conversation.waUserPhone || conversation.waUserId)}`}>
                        {getInitials(conversation.waUserName || conversation.waUserPhone || conversation.waUserId)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm truncate">
                              {conversation.waUserName || conversation.waUserPhone || conversation.waUserId}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {format(new Date(conversation.lastMessageAt), 'dd/MM HH:mm')}
                            </p>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8 -mt-1 -mr-1">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => handleArchive(conversation, e)}>
                                <Archive className="h-4 w-4 mr-2" />
                                Arquivar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConversationToDelete(conversation);
                                }}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap mt-2">
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
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!conversationToDelete} onOpenChange={() => setConversationToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conversa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A conversa com{' '}
              <strong>
                {conversationToDelete?.waUserName ||
                  conversationToDelete?.waUserPhone ||
                  conversationToDelete?.waUserId}
              </strong>{' '}
              e todas as mensagens serão excluídas permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
