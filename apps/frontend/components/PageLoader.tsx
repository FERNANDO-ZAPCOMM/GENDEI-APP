interface PageLoaderProps {
  message?: string;
}

// WhatsApp-style typing indicator dots
function TypingDots({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dotSizes = {
    sm: 'w-1 h-1',
    md: 'w-1.5 h-1.5',
    lg: 'w-2 h-2',
  };

  const dotSize = dotSizes[size];

  return (
    <div className="inline-flex items-center gap-0.5">
      <span
        className={`${dotSize} bg-slate-400 rounded-full animate-[typing_1.4s_ease-in-out_infinite]`}
        style={{ animationDelay: '0ms' }}
      />
      <span
        className={`${dotSize} bg-slate-400 rounded-full animate-[typing_1.4s_ease-in-out_infinite]`}
        style={{ animationDelay: '200ms' }}
      />
      <span
        className={`${dotSize} bg-slate-400 rounded-full animate-[typing_1.4s_ease-in-out_infinite]`}
        style={{ animationDelay: '400ms' }}
      />
      <style jsx>{`
        @keyframes typing {
          0%, 60%, 100% {
            transform: translateY(0);
            opacity: 0.4;
          }
          30% {
            transform: translateY(-2px);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

export function PageLoader({ message }: PageLoaderProps) {
  return (
    <div className="flex min-h-[400px] w-full flex-col items-center justify-center">
      <div className="bg-white rounded-full px-4 py-3 shadow-sm border border-slate-100">
        <TypingDots size="md" />
      </div>
      {message && <p className="mt-4 text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}

export function FullPageLoader({ message }: PageLoaderProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="bg-white rounded-full px-5 py-3 shadow-lg border border-slate-100">
        <TypingDots size="lg" />
      </div>
      {message && <p className="mt-4 text-base text-muted-foreground">{message}</p>}
    </div>
  );
}

// Export TypingDots for reuse
export { TypingDots };
