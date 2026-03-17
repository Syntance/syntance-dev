"use client";

import { useState, useEffect } from "react";
import { Send, MessageSquare, Loader2 } from "lucide-react";

interface FeedbackItem {
  id: string;
  message: string;
  createdAt: string;
}

export default function FeedbackPage() {
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  async function fetchFeedbacks() {
    setLoading(true);
    try {
      const res = await fetch("/api/feedback");
      if (res.ok) {
        setFeedbacks(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || sending) return;

    setSending(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      if (res.ok) {
        setMessage("");
        fetchFeedbacks();
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Feedback</h1>
        <p className="text-sm text-muted-foreground">
          Podziel się swoimi uwagami dotyczącymi projektu
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-6">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Napisz swoje uwagi, sugestie lub pytania..."
          rows={4}
          className="mb-4 w-full resize-none rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-accent-light focus:outline-none focus:ring-2 focus:ring-accent/20"
          disabled={sending}
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={sending || !message.trim()}
            className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-light disabled:opacity-50"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Wyślij
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-sm font-medium text-muted-foreground">
            Historia feedbacku
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : feedbacks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <MessageSquare className="mb-3 h-10 w-10 opacity-30" />
            <p className="text-sm">Brak feedbacku</p>
            <p className="text-xs text-muted-foreground/50">
              Twoje wiadomości pojawią się tutaj
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {feedbacks.map((fb) => (
              <div key={fb.id} className="px-6 py-4">
                <p className="text-sm text-foreground">{fb.message}</p>
                <p className="mt-2 text-xs text-muted-foreground/50">
                  {new Date(fb.createdAt).toLocaleDateString("pl-PL", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
