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
