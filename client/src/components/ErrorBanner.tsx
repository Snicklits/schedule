interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <div className="rounded bg-red-50 border border-red-300 text-red-700 px-4 py-3 flex items-start gap-3 text-sm">
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="font-bold hover:text-red-900">
          ×
        </button>
      )}
    </div>
  );
}
