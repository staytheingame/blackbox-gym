"use client";

import { useState, type FormEvent } from "react";

export function ContactForm() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="rounded-sm border border-brand-yellow bg-brand-surface p-6 text-sm text-brand-white">
        Mesajın alındı. Bu, yerel geliştirme sürümü olduğu için mesaj
        şu an hiçbir yere gönderilmiyor — üretim sürümünde e-posta/CRM
        entegrasyonu eklenecek.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="name"
          className="text-xs font-bold uppercase tracking-wide text-brand-muted"
        >
          Ad Soyad
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          className="mt-1 w-full rounded-sm border border-brand-border bg-brand-black px-3 py-2 text-base text-brand-white outline-none focus:border-brand-yellow sm:text-sm"
        />
      </div>
      <div>
        <label
          htmlFor="email"
          className="text-xs font-bold uppercase tracking-wide text-brand-muted"
        >
          E-posta
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="mt-1 w-full rounded-sm border border-brand-border bg-brand-black px-3 py-2 text-base text-brand-white outline-none focus:border-brand-yellow sm:text-sm"
        />
      </div>
      <div>
        <label
          htmlFor="message"
          className="text-xs font-bold uppercase tracking-wide text-brand-muted"
        >
          Mesaj
        </label>
        <textarea
          id="message"
          name="message"
          rows={4}
          required
          className="mt-1 w-full rounded-sm border border-brand-border bg-brand-black px-3 py-2 text-base text-brand-white outline-none focus:border-brand-yellow sm:text-sm"
        />
      </div>
      <button
        type="submit"
        className="w-full rounded-sm bg-brand-yellow px-4 py-3 text-sm font-bold uppercase tracking-wide text-brand-black transition-colors hover:bg-brand-white"
      >
        Gönder
      </button>
    </form>
  );
}
