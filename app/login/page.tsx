"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SyntanceLogo } from "@/components/logo";
import { Loader2, Mail, Lock } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [noPassword, setNoPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setNoPassword(false);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push("/projects");
      } else {
        if (data.code === "NO_PASSWORD") {
          setNoPassword(true);
        }
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
            <h1 className="mb-2 text-center text-lg font-semibold">
              Zaloguj się
            </h1>
            <p className="mb-6 text-center text-sm text-muted-foreground">
              Wpisz email i hasło do swojego portalu
            </p>

            {error && (
              <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {error}
                {noPassword && (
                  <Link
                    href={`/set-password?email=${encodeURIComponent(email)}`}
                    className="mt-2 block font-medium text-accent-light hover:underline"
                  >
                    Ustaw hasło teraz →
                  </Link>
                )}
              </div>
            )}

            <form onSubmit={handleLogin}>
              <div className="relative mb-3">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Hasło"
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
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Logowanie...
                  </>
                ) : (
                  "Zaloguj się"
                )}
              </button>
            </form>

            <div className="mt-4 flex flex-col gap-2 text-center text-sm">
              <Link
                href="/forgot-password"
                className="text-muted-foreground transition-colors hover:text-accent-light"
              >
                Zapomniałeś hasła?
              </Link>
              <Link
                href="/set-password"
                className="text-muted-foreground transition-colors hover:text-accent-light"
              >
                Pierwsze logowanie? Ustaw hasło
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
