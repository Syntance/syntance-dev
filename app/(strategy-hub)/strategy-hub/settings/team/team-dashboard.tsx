"use client";

import { useState } from "react";
import { Mail, Shield, ShieldCheck, Trash2, UserPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TeamMember } from "@/lib/strategy-hub/team";

interface Props {
  initialMembers: TeamMember[];
  currentEmail: string;
  currentRole: "owner" | "member";
}

export function TeamDashboard({ initialMembers, currentEmail, currentRole }: Props) {
  const [members, setMembers] = useState(initialMembers);
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);

  const isOwner = currentRole === "owner";

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setInviting(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/strategy-hub/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Nie udało się wysłać zaproszenia");
        return;
      }

      setMembers((prev) => [...prev, data.member]);
      setSuccess(`Zaproszenie wysłane do ${data.member.email}`);
      setEmail("");
    } catch {
      setError("Nie udało się połączyć z serwerem");
    } finally {
      setInviting(false);
    }
  }

  async function handleRemove(id: string) {
    setRemovingId(id);
    setError("");
    try {
      const res = await fetch(`/api/strategy-hub/team/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Nie udało się usunąć członka zespołu");
        return;
      }
      setMembers((prev) => prev.filter((m) => m.id !== id));
    } catch {
      setError("Nie udało się połączyć z serwerem");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {isOwner ? (
        <form
          onSubmit={handleInvite}
          className="rounded-xl border border-border/60 bg-card/40 p-4 space-y-3"
        >
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center">
              <UserPlus className="size-3.5 text-brand" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Zaproś współpracownika</h2>
              <p className="text-xs text-muted-foreground">
                Otrzyma email z linkiem do ustawienia hasła (ważny 7 dni)
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="kolega@agencja.pl"
              className="flex-1"
              disabled={inviting}
              aria-label="Email zapraszanej osoby"
            />
            <Button type="submit" disabled={inviting || !email.trim()} className="gap-1.5">
              {inviting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Mail className="size-3.5" />
              )}
              Zaproś
            </Button>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
          {success && <p className="text-xs text-success">{success}</p>}
        </form>
      ) : (
        <p className="text-xs text-muted-foreground rounded-lg border border-border/60 bg-card/40 p-3">
          Tylko właściciel workspace może zapraszać i usuwać członków zespołu.
        </p>
      )}

      <div className="rounded-xl border border-border/60 bg-card/40 divide-y divide-border/40">
        {members.map((m) => {
          const isSelf = m.email.toLowerCase() === currentEmail.toLowerCase();
          return (
            <div key={m.id} className="flex items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={cn(
                    "size-8 rounded-full flex items-center justify-center shrink-0",
                    m.role === "owner"
                      ? "bg-brand/10 border border-brand/20"
                      : "bg-muted border border-border/60"
                  )}
                >
                  {m.role === "owner" ? (
                    <ShieldCheck className="size-3.5 text-brand" />
                  ) : (
                    <Shield className="size-3.5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {m.email} {isSelf && <span className="text-muted-foreground">(Ty)</span>}
                  </p>
                  <Badge variant="outline" className="text-[10px] mt-0.5">
                    {m.role === "owner" ? "Właściciel" : "Członek"}
                  </Badge>
                </div>
              </div>

              {isOwner && !isSelf && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemove(m.id)}
                  disabled={removingId === m.id}
                  aria-label={`Usuń ${m.email} z zespołu`}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                >
                  {removingId === m.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="size-3.5" />
                  )}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
