"use client";

import { useState } from "react";
import Link from "next/link";
import { SyntanceLogo } from "@/components/logo";
import { Loader2, Mail, CheckCircle } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/request-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setSent(true);
      } else {
        const data = await res.json();
        setError(data.error || "Wystąpił błąd");
      }
    } catch {
      setError("Nie udało się połączyć z serwerem");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <div className="absolute left-6 top-6">
        <SyntanceLogo />
      </div>

      <div className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="rounded-xl border border-border bg-card p-8">
            {sent ? (
              <div className="text-center">
                <CheckCircle className="mx-auto mb-4 h-12 w-12 text-success" />
                <h1 className="mb-2 text-lg font-semibold">Sprawdź email</h1>
                <p className="text-sm text-muted-foreground">
                  Jeśli konto z tym adresem istnieje, wysłaliśmy link do
                  zresetowania hasła.
                </p>
                <Link
                  href="/login"
                  className="mt-6 inline-block text-sm text-accent-light hover:underline"
                >
                  Wróć do logowania
                </Link>
              </div>
            ) : (
              <>
                <h1 className="mb-2 text-center text-lg font-semibold">
                  Zapomniałeś hasła?
                </h1>
                <p className="mb-6 text-center text-sm text-muted-foreground">
                  Podaj email, a wyślemy Ci link do resetu hasła
                </p>

                {error && (
                  <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit}>
                  <div className="relative mb-4">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Twój email"
                      className="w-full rounded-lg border border-border bg-background py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-accent-light focus:outline-none focus:ring-2 focus:ring-accent/20"
                      disabled={loading}
                      required
                      autoFocus
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-light disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Wyślij link"
                    )}
                  </button>
                </form>

                <div className="mt-4 text-center">
                  <Link
                    href="/login"
                    className="text-sm text-muted-foreground transition-colors hover:text-accent-light"
                  >
                    Wróć do logowania
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
