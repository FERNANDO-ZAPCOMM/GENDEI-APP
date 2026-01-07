import { Badge } from '@/components/ui/badge';
import { Eye } from 'lucide-react';

interface ReadOnlyBadgeProps {
  className?: string;
  message?: string;
}

/**
 * Badge to indicate read-only mode
 * Shows when user has view permission but not manage permission
 */
export function ReadOnlyBadge({
  className = '',
  message = 'Read Only'
}: ReadOnlyBadgeProps) {
  return (
    <Badge
      variant="secondary"
      className={`gap-1 ${className}`}
    >
      <Eye className="w-3 h-3" />
      {message}
    </Badge>
  );
}
