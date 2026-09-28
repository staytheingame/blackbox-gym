"use client";

import { useTransition } from "react";

/**
 * Onaylı tehlikeli işlem düğmesi (silme gibi). Tarayıcının kendi onay
 * penceresini açar; onaylanmazsa sunucuya hiçbir şey gitmez.
 *
 * `action` bir server action'dır ve sonucu (`error`) döndürürse ekranda uyarı
 * olarak gösterilir — silinemeyen kayıt sessizce "silinmiş gibi" kalmasın.
 */
export function ConfirmActionButton({
  action,
  confirmText,
  children,
  className,
  title,
}: {
  action: () => Promise<{ error?: string } | void>;
  confirmText: string;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      title={title}
      className={className}
      onClick={() => {
        if (!window.confirm(confirmText)) return;
        startTransition(async () => {
          const result = await action();
          if (result && result.error) window.alert(result.error);
        });
      }}
    >
      {pending ? "…" : children}
    </button>
  );
}
