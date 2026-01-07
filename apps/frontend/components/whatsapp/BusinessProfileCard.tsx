'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Upload, Save, User, AlertCircle, CheckCircle2, Camera, FileText, Building2, Globe } from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useWhatsAppBusinessProfile, type WhatsAppBusinessProfile } from '@/hooks/use-whatsapp-business-profile';
import { cn } from '@/lib/utils';

interface BusinessProfileCardProps {
  phoneNumberId: string;
}

// WhatsApp Business vertical options
const VERTICAL_OPTIONS = [
  'UNDEFINED',
  'OTHER',
  'AUTO',
  'BEAUTY',
  'APPAREL',
  'EDU',
  'ENTERTAIN',
  'EVENT_PLAN',
  'FINANCE',
  'GROCERY',
  'GOVT',
  'HOTEL',
  'HEALTH',
  'NONPROFIT',
  'PROF_SERVICES',
  'RETAIL',
  'TRAVEL',
  'RESTAURANT',
  'NOT_A_BIZ',
];

type TabKey = 'photo' | 'status' | 'description' | 'category' | 'website';

export function BusinessProfileCard({ phoneNumberId }: BusinessProfileCardProps) {
  const t = useTranslations();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('photo');

  const {
    profile,
    isLoading,
    error,
    updateProfileAsync,
    isUpdating,
    updateError,
    uploadPictureAsync,
    isUploading,
  } = useWhatsAppBusinessProfile(phoneNumberId);

  // Form state
  const [formData, setFormData] = useState<Partial<WhatsAppBusinessProfile>>({
    about: '',
    description: '',
    email: '',
    vertical: 'UNDEFINED',
    websites: [''],
  });

  // Update form data when profile loads
  useEffect(() => {
    if (profile) {
      setFormData({
        about: profile.about || '',
        description: profile.description || '',
        email: profile.email || '',
        vertical: profile.vertical || 'UNDEFINED',
        websites: profile.websites?.length ? profile.websites : [''],
      });
    }
  }, [profile]);

  const handleInputChange = (field: keyof WhatsAppBusinessProfile, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleWebsiteChange = (index: number, value: string) => {
    setFormData((prev) => {
      const websites = [...(prev.websites || [''])];
      websites[index] = value;
      return { ...prev, websites };
    });
  };

  const addWebsite = () => {
    if ((formData.websites?.length || 0) < 2) {
      setFormData((prev) => ({
        ...prev,
        websites: [...(prev.websites || []), ''],
      }));
    }
  };

  const removeWebsite = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      websites: (prev.websites || []).filter((_, i) => i !== index),
    }));
  };

  const handleSave = async () => {
    try {
      // Filter out empty websites
      const cleanData = {
        ...formData,
        websites: formData.websites?.filter((w) => w.trim() !== ''),
      };
      await updateProfileAsync(cleanData);
      toast.success(t('whatsapp.businessProfile.saveSuccess') || 'Profile updated');
    } catch (err) {
      toast.error((err as Error).message || t('whatsapp.businessProfile.saveError') || 'Update failed');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      toast.error(t('whatsapp.businessProfile.invalidImageTypeDescription') || 'Please select a JPEG or PNG image.');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('whatsapp.businessProfile.imageTooLargeDescription') || 'Please select an image smaller than 5MB.');
      return;
    }

    try {
      await uploadPictureAsync(file);
      toast.success(t('whatsapp.businessProfile.pictureUploadSuccess') || 'Picture uploaded');
    } catch (err) {
      toast.error((err as Error).message || t('whatsapp.businessProfile.pictureUploadError') || 'Upload failed');
    }

    // Reset the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Check completion status for each step
  const hasPhoto = !!profile?.profile_picture_url;
  const hasStatus = !!(formData.about && formData.about.trim().length > 0);
  const hasDescription = !!(formData.description && formData.description.trim().length > 0);
  const hasCategory = !!(formData.vertical && formData.vertical !== 'UNDEFINED');
  const hasWebsite = !!(formData.websites && formData.websites.some(w => w.trim().length > 0));

  const completedSteps = [hasPhoto, hasStatus, hasDescription, hasCategory, hasWebsite].filter(Boolean).length;
  const totalSteps = 5;

  const tabs: { key: TabKey; icon: React.ReactNode; label: string; completed: boolean }[] = [
    { key: 'photo', icon: <Camera className="h-4 w-4" />, label: t('whatsapp.businessProfile.profilePicture') || 'Photo', completed: hasPhoto },
    { key: 'status', icon: <FileText className="h-4 w-4" />, label: t('whatsapp.businessProfile.about') || 'Status', completed: hasStatus },
    { key: 'description', icon: <FileText className="h-4 w-4" />, label: t('whatsapp.businessProfile.businessDescription') || 'Description', completed: hasDescription },
    { key: 'category', icon: <Building2 className="h-4 w-4" />, label: t('whatsapp.businessProfile.category') || 'Category', completed: hasCategory },
    { key: 'website', icon: <Globe className="h-4 w-4" />, label: t('whatsapp.businessProfile.websites') || 'Website', completed: hasWebsite },
  ];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {t('whatsapp.businessProfile.loadError') || 'Failed to load business profile'}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>
              {t('whatsapp.businessProfile.title') || 'Business Profile'}
            </CardTitle>
            <CardDescription>
              {t('whatsapp.businessProfile.description') || 'Customize how your business appears to customers on WhatsApp'}
            </CardDescription>
          </div>
          <div className="text-xs text-gray-500">
            {completedSteps}/{totalSteps} {t('whatsapp.businessProfile.completed') || 'completed'}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Horizontal Tabs */}
        <div className="flex flex-row gap-1 pb-2 border-b overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex-1 min-w-0 flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap',
                activeTab === tab.key
                  ? tab.completed
                    ? 'border-2 border-green-500 bg-green-50 text-green-700'
                    : 'border-2 border-gray-500 bg-gray-100 text-gray-600'
                  : tab.completed
                    ? 'border border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                    : 'border border-gray-200 bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {tab.completed && activeTab !== tab.key ? (
                <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
              ) : (
                <span className="flex-shrink-0">{tab.icon}</span>
              )}
              <span className="truncate">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="min-h-[120px]">
          {/* Photo Tab */}
          {activeTab === 'photo' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                {t('whatsapp.businessProfile.profilePictureDescription') || 'Upload a square image (JPEG or PNG, max 5MB)'}
              </p>
              <div className="flex items-center gap-4">
                <div className="relative h-16 w-16 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                  {profile?.profile_picture_url ? (
                    <Image
                      src={profile.profile_picture_url}
                      alt="Business profile"
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  ) : (
                    <User className="h-8 w-8 text-gray-400" />
                  )}
                  {isUploading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-white" />
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  {t('whatsapp.businessProfile.uploadButton') || 'Upload'}
                </Button>
              </div>
            </div>
          )}

          {/* Status Tab */}
          {activeTab === 'status' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                {t('whatsapp.businessProfile.aboutDescription') || 'A brief description shown in your profile (max 139)'}
              </p>
              <Input
                value={formData.about || ''}
                onChange={(e) => handleInputChange('about', e.target.value)}
                maxLength={139}
                placeholder={t('whatsapp.businessProfile.aboutPlaceholder') || 'Transforme suas fotos em vídeos animados com IA!'}
              />
              <p className="text-xs text-gray-400 text-right">{(formData.about?.length || 0)}/139</p>
            </div>
          )}

          {/* Description Tab */}
          {activeTab === 'description' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                {t('whatsapp.businessProfile.descriptionHelp') || 'Tell customers about your business (max 512)'}
              </p>
              <Textarea
                value={formData.description || ''}
                onChange={(e) => handleInputChange('description', e.target.value)}
                maxLength={512}
                rows={3}
                placeholder={t('whatsapp.businessProfile.descriptionPlaceholder') || 'Animação de fotos via WhatsApp! IA transforma foto em vídeo animado. Envie sua foto e receba seu vídeo em minutos!'}
              />
              <p className="text-xs text-gray-400 text-right">{(formData.description?.length || 0)}/512</p>
            </div>
          )}

          {/* Category Tab */}
          {activeTab === 'category' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                {t('whatsapp.businessProfile.categoryDescription') || 'Select your business category'}
              </p>
              <Select
                value={formData.vertical || 'UNDEFINED'}
                onValueChange={(value) => handleInputChange('vertical', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VERTICAL_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(`whatsapp.businessProfile.vertical.${option}`) || option.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Website Tab */}
          {activeTab === 'website' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                {t('whatsapp.businessProfile.websiteDescription') || 'Your website URL'}
              </p>
              <Input
                value={formData.websites?.[0] || ''}
                onChange={(e) => handleWebsiteChange(0, e.target.value)}
                placeholder="https://example.com"
                maxLength={256}
              />
            </div>
          )}
        </div>

        {/* Error Display */}
        {updateError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{(updateError as Error).message}</AlertDescription>
          </Alert>
        )}

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={isUpdating}
        >
          {isUpdating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {t('whatsapp.businessProfile.saving') || 'Saving...'}
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              {t('whatsapp.businessProfile.save') || 'Save Profile'}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
