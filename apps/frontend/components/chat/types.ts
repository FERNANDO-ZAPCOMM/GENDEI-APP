export type Message = {
  id: string;
  who: 'bot' | 'user';
  text: string;
  timestamp?: Date;
  field?: string | null;
  category?: string | null;
  isPrompt?: boolean;
  imageUrl?: string;  // Optional image to display with the message
};

export type StepType =
  | 'text'
  | 'select'
  | 'multiselect'
  | 'file-upload'
  | 'price'
  | 'textarea'
  | 'price-chips'       // Quick price selection with chips + custom input
  | 'yesno'             // Yes/No buttons with colors
  | 'activity-cards'    // Cards with Yes/No or text input for each item
  | 'suggestions'       // AI-generated suggestions with custom input option
  | 'dropdown'          // Searchable dropdown
  | 'thumbnail';        // Thumbnail selection (PDF cover, upload, or generate)

export type StepOption = {
  value: string;
  label: string;
  description?: string;
  emoji?: string;       // Optional emoji for chips
  color?: 'default' | 'green' | 'red' | 'blue' | 'purple' | 'orange';
};

// Activity card for objections/features handling
export type ActivityItem = {
  id: string;
  label: string;
  description?: string;
  type: 'yesno' | 'text';   // Type of response expected
  response?: string | boolean;
};

// AI suggestion for objection responses
export type Suggestion = {
  id: string;
  text: string;
  isAI?: boolean;
};

export type Step = {
  id: string;
  type: StepType;
  prompt?: string;
  placeholder?: string;
  options?: StepOption[];
  required?: boolean;
  validation?: (value: string) => string | null;
  // Enhanced step properties
  activities?: ActivityItem[];           // For activity-cards type
  suggestions?: Suggestion[];            // For suggestions type
  priceOptions?: number[];              // For price-chips type (e.g., [27, 47, 97, 197])
  allowCustom?: boolean;                // Allow custom input in chips/suggestions
  horizontal?: boolean;                 // Show suggestions in horizontal scroll
  conditional?: {                       // Conditional step based on previous answer
    dependsOn: string;                  // Step ID to check
    showWhen: string | boolean;         // Value that triggers this step
  };
  // Thumbnail step properties
  pdfCoverUrl?: string;                 // Preview of extracted PDF cover
};

export type ProductData = {
  name?: string;
  description?: string;
  price?: number;
  currency?: string;
  productType?: string;
  niche?: string;
  targetAudience?: string;
  mainBenefit?: string;
  objections?: string[];
  objectionResponses?: Record<string, string>;
  faq?: Array<{ question: string; answer: string }>;
  fileUrl?: string;
  fileName?: string;
  tone?: string;
  // Enhanced fields
  hasFile?: boolean;              // Whether user wants to upload a file
  hasObjections?: boolean;        // Whether user has common objections to handle
  selectedObjections?: string[];  // Which objections user selected
  customObjections?: string[];    // Custom objections typed by user
  // Document analysis data (for RAG)
  documentAnalysis?: DocumentAnalysis;
  // Thumbnail for product catalog
  thumbnailUrl?: string;          // URL of the thumbnail image
  thumbnailSource?: 'pdf' | 'upload' | 'generated'; // How the thumbnail was created
  // Delivery configuration for free products
  deliveryUrl?: string;           // URL where customer can access/download the product
  deliveryMessage?: string;       // Custom message to send with delivery
};

// AI analysis from document
export type DocumentAnalysis = {
  suggestedName?: string;
  suggestedDescription?: string;
  suggestedBenefits?: string[];
  suggestedPrice?: number;
  topics?: string[];
  targetAudience?: string;
  summary?: string;
  // PDF cover extraction
  pdfCoverUrl?: string;           // Data URL of extracted PDF first page
};

export type ConversationState = {
  currentStepIndex: number;
  messages: Message[];
  productData: ProductData;
  isComplete: boolean;
  isTyping: boolean;
};

// Creator profile onboarding data
export type CreatorData = {
  displayName?: string;
  niche?: string;
  voiceStyle?: 'friendly_coach' | 'professional_expert' | 'formal_consultant';
  upcomingProducts?: string;
  servicesPreview?: string;
  welcomeMessage?: string;
  // Mandatory settings
  productTypes?: ('ebook' | 'mentoring' | 'community')[];
  leadTemperature?: number; // 0-100 scale
  showProductsInGreeting?: boolean;
};
