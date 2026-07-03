"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ArchiveProjectDialogProps {
  projectId: string;
  projectName: string;
}

export function ArchiveProjectDialog({
  projectId,
  projectName,
}: ArchiveProjectDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/strategy-hub/projects/${projectId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setError("Nie udało się zarchiwizować projektu. Spróbuj ponownie.");
        return;
      }
      setOpen(false);
      router.push("/strategy-hub");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive" size="sm" />}>
        <Archive className="size-4" />
        Archiwizuj projekt
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Zarchiwizować projekt „{projectName}”?</DialogTitle>
          <DialogDescription>
            Projekt zniknie z listy projektów i wszystkich widoków Strategy
            Hub. Dane nie zostaną usunięte — archiwizację można cofnąć,
            kontaktując się z administratorem systemu.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p className="text-xs text-destructive rounded-md bg-destructive/10 p-2">
            {error}
          </p>
        )}
        <DialogFooter showCloseButton>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Archive className="size-4" />
            )}
            Tak, archiwizuj
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
