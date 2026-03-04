import { useToast } from "../contexts/ToastContext.js";

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => removeToast(t.id)}
          className={`cursor-pointer rounded px-4 py-2 text-white shadow-lg text-sm ${
            t.type === "success"
              ? "bg-green-600"
              : t.type === "error"
                ? "bg-red-600"
                : "bg-gray-700"
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
