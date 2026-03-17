"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { SyntanceLogo } from "@/components/logo";
import {
  Loader2,
  LogOut,
  ExternalLink,
  MessageSquare,
  X,
  Users,
  Layers,
} from "lucide-react";
import { clsx } from "clsx";

const STATUS_LABELS: Record<string, string> = {
  design: "Projektowanie",
  development: "Development",
  qa: "Testowanie",
  review: "Review",
  live: "Live",
};

const STATUS_COLORS: Record<string, string> = {
  design: "bg-blue-500/10 text-blue-400",
  development: "bg-yellow-500/10 text-yellow-400",
  qa: "bg-orange-500/10 text-orange-400",
  review: "bg-purple-500/10 text-purple-400",
  live: "bg-green-500/10 text-green-400",
};

interface Project {
  _id: string;
  name: string;
  slug: string;
  clientEmail: string;
  clientName: string | null;
  previewUrl: string;
  status: string;
  _createdAt: string;
}

interface FeedbackItem {
  id: string;
  message: string;
  email: string;
  projectSlug: string;
  createdAt: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedbackSlug, setFeedbackSlug] = useState<string | null>(null);
  const [slugFeedbacks, setSlugFeedbacks] = useState<FeedbackItem[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [projectsRes, feedbacksRes] = await Promise.all([
        fetch("/api/admin/projects"),
        fetch("/api/admin/feedbacks"),
      ]);

      if (projectsRes.status === 401) {
        setAuthed(false);
        setLoading(false);
        return;
      }

      if (projectsRes.ok) {
        setProjects(await projectsRes.json());
        setAuthed(true);
      }
      if (feedbacksRes.ok) {
        setFeedbacks(await feedbacksRes.json());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "admin", email, password }),
      });

      if (res.ok) {
        setAuthed(true);
        fetchData();
      } else {
        const data = await res.json();
        setLoginError(data.error);
      }
    } catch {
      setLoginError("Błąd połączenia");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setAuthed(false);
    router.refresh();
  }

  function showSlugFeedbacks(slug: string) {
    setFeedbackSlug(slug);
    setSlugFeedbacks(feedbacks.filter((f) => f.projectSlug === slug));
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex justify-center">
            <SyntanceLogo />
          </div>
          <div className="rounded-xl border border-border bg-card p-8">
            <h1 className="mb-2 text-center text-lg font-semibold">
              Panel admina
            </h1>
            <p className="mb-6 text-center text-sm text-muted-foreground">
              Zaloguj się, aby zarządzać portalem
            </p>

            {loginError && (
              <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {loginError}
              </div>
            )}

            <form onSubmit={handleLogin}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="mb-3 w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-accent-light focus:outline-none focus:ring-2 focus:ring-accent/20"
                required
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Hasło"
                className="mb-4 w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-accent-light focus:outline-none focus:ring-2 focus:ring-accent/20"
                required
              />
              <button
                type="submit"
                disabled={loginLoading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-light disabled:opacity-50"
              >
                {loginLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Zaloguj"
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const feedbackCounts = feedbacks.reduce(
    (acc, f) => {
      acc[f.projectSlug] = (acc[f.projectSlug] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <SyntanceLogo />
            <div className="h-6 w-px bg-border" />
            <span className="text-sm text-muted-foreground">Admin</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/studio"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
            >
              <Layers className="h-4 w-4" />
              Sanity Studio
            </a>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              Wyloguj
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Projekty</h1>
            <p className="text-sm text-muted-foreground">
              Zarządzaj projektami w{" "}
              <a
                href="/studio"
                target="_blank"
                className="text-accent-light hover:underline"
              >
                Sanity Studio
              </a>
              . Poniżej widok z feedbackiem klientów.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-1 flex items-center gap-2 text-muted-foreground">
              <Layers className="h-4 w-4" />
              <span className="text-xs font-medium">Projekty</span>
            </div>
            <p className="text-2xl font-bold">{projects.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-1 flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              <span className="text-xs font-medium">Klienci</span>
            </div>
            <p className="text-2xl font-bold">
              {new Set(projects.map((p) => p.clientEmail)).size}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-1 flex items-center gap-2 text-muted-foreground">
              <MessageSquare className="h-4 w-4" />
              <span className="text-xs font-medium">Feedback</span>
            </div>
            <p className="text-2xl font-bold">{feedbacks.length}</p>
          </div>
        </div>

        <div className="mt-8">
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-muted-foreground">
              <p className="text-sm">Brak projektów w Sanity</p>
              <p className="text-xs text-muted-foreground/50">
                Dodaj pierwszy projekt w{" "}
                <a
                  href="/studio"
                  target="_blank"
                  className="text-accent-light hover:underline"
                >
                  Sanity Studio
                </a>
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {projects.map((project) => (
                <div
                  key={project._id}
                  className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-border/80"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold">{project.name}</h3>
                        <span
                          className={clsx(
                            "rounded-full px-2.5 py-0.5 text-xs font-medium",
                            STATUS_COLORS[project.status] ||
                              "bg-muted text-muted-foreground"
                          )}
                        >
                          {STATUS_LABELS[project.status] || project.status}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {project.slug}.syntance.dev · {project.clientEmail}
                        {project.clientName ? ` · ${project.clientName}` : ""}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={project.previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                        title="Otwórz preview"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>

                      {(feedbackCounts[project.slug] || 0) > 0 && (
                        <button
                          onClick={() => showSlugFeedbacks(project.slug)}
                          className="flex items-center gap-1 rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                          title="Pokaż feedback"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          <span className="text-xs">
                            {feedbackCounts[project.slug]}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {feedbackSlug && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="font-semibold">
                Feedback — {feedbackSlug}.syntance.dev
              </h2>
              <button
                onClick={() => setFeedbackSlug(null)}
                className="rounded-lg p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {slugFeedbacks.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Brak feedbacku
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {slugFeedbacks.map((fb) => (
                    <div key={fb.id} className="px-6 py-4">
                      <p className="text-sm">{fb.message}</p>
                      <p className="mt-1 text-xs text-muted-foreground/50">
                        {fb.email} ·{" "}
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
        </div>
      )}
    </div>
  );
}
