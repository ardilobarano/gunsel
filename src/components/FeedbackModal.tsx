"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface FeedbackModalProps {
  onClose: () => void;
}

const MAX_MESSAGE = 2000;

export default function FeedbackModal({ onClose }: FeedbackModalProps) {
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const trimmed = message.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          contact,
          // Hangi sayfadan gönderildiği — bildirilen sorunun yerini bulmayı kolaylaştırıyor.
          page: window.location.pathname,
        }),
      });
      const data: { error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Gönderilemedi, tekrar dener misin?");
        return;
      }
      setSent(true);
    } catch {
      setError("Bağlamsal kurulamadı, tekrar dener misin?");
    } finally {
      setSending(false);
    }
  }

  // Header'daki backdrop-blur fixed konumlu elemanların referansını kaydırdığı için
  // modal portal ile body'ye taşınıyor (SettingsMenu ile aynı sebep).
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border border-border-subtle bg-card p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-text-main">Geri Bildirim</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="text-text-muted transition-colors hover:text-text-main"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {sent ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <p className="text-sm text-text-main">Teşekkürler, mesajın bize ulaştı.</p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-accent-green px-4 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
            >
              Kapat
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-text-muted">
              Bir hata mı buldun, bir fikrin mi var? Yaz, okuyoruz.
            </p>

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
              rows={5}
              autoFocus
              placeholder="Mesajın..."
              className="w-full resize-none rounded-lg border border-border-subtle bg-background px-3 py-2 text-sm text-text-main placeholder:text-text-muted focus:border-text-muted focus:outline-none"
            />

            <input
              type="text"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="E-posta (isteğe bağlı, cevap için)"
              className="w-full rounded-lg border border-border-subtle bg-background px-3 py-2 text-sm text-text-main placeholder:text-text-muted focus:border-text-muted focus:outline-none"
            />

            {error && <p className="text-sm font-medium text-accent-red">{error}</p>}

            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-text-muted">
                {message.length}/{MAX_MESSAGE}
              </span>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!message.trim() || sending}
                className="rounded-lg bg-accent-green px-4 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {sending ? "Gönderiliyor..." : "Gönder"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
