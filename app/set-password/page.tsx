"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { SyntanceLogo } from "@/components/logo";
import { Loader2, Mail, Lock, CheckCircle } from "lucide-react";

function SetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("token");
  const emailFromUrl = searchParams.get("email");

  const [step, setStep] = useState<"request" | "set">(
    tokenFromUrl ? "set" : "request"
  );
  const [email, setEmail] = useState(emailFromUrl || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRequestSetup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/request-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(
          "Jeśli Twój email jest przypisany do projektu, otrzymasz link do ustawienia hasła."
        );
      } else {
        if (data.code === "HAS_PASSWORD") {
          setError(data.error);
        } else {
          setError(data.error || "Wystąpił błąd");
        }
      }
    } catch {
      setError("Nie udało się połączyć z serwerem");
    } finally {
      setLoading(false);
    }
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Hasła nie są identyczne");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenFromUrl, password }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push("/dashboard");
      } else {
        setError(data.error || "Wystąpił błąd");
      }
    } catch {
      setError("Nie udało się połączyć z serwerem");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="w-full max-w-sm">
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <CheckCircle className="mx-auto mb-4 h-12 w-12 text-success" />
          <h1 className="mb-2 text-lg font-semibold">Sprawdź email</h1>
          <p className="text-sm text-muted-foreground">{success}</p>
          <Link
            href="/login"
            className="mt-6 inline-block text-sm text-accent-light hover:underline"
          >
            Wróć do logowania
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <div className="rounded-xl border border-border bg-card p-8">
        <h1 className="mb-2 text-center text-lg font-semibold">
          {step === "request" ? "Ustaw hasło" : "Nowe hasło"}
        </h1>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          {step === "request"
            ? "Podaj email przypisany do projektu"
            : "Ustaw hasło do swojego konta"}
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {step === "request" ? (
          <form onSubmit={handleRequestSetup}>
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
        ) : (
          <form onSubmit={handleSetPassword}>
            <div className="relative mb-3">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nowe hasło (min. 8 znaków)"
                minLength={8}
                className="w-full rounded-lg border border-border bg-background py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-accent-light focus:outline-none focus:ring-2 focus:ring-accent/20"
                disabled={loading}
                required
                autoFocus
              />
            </div>
            <div className="relative mb-4">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Powtórz hasło"
                minLength={8}
                className="w-full rounded-lg border border-border bg-background py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-accent-light focus:outline-none focus:ring-2 focus:ring-accent/20"
                disabled={loading}
                required
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
                "Ustaw hasło"
              )}
            </button>
          </form>
        )}

        <div className="mt-4 text-center">
          <Link
            href="/login"
            className="text-sm text-muted-foreground transition-colors hover:text-accent-light"
          >
            Wróć do logowania
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <div className="min-h-screen">
      <div className="absolute left-6 top-6">
        <SyntanceLogo />
      </div>

      <div className="flex min-h-screen flex-col items-center justify-center p-8">
        <Suspense
          fallback={
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          }
        >
          <SetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
