"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

interface Project {
  name: string;
  slug: string;
  status: string;
}

interface ProjectSelectorProps {
  projects: Project[];
  currentSlug: string;
}

const STATUS_COLORS: Record<string, string> = {
  design: "bg-purple-500",
  development: "bg-blue-500",
  qa: "bg-yellow-500",
  review: "bg-orange-500",
  live: "bg-green-500",
};

export function ProjectSelector({
  projects,
  currentSlug,
}: ProjectSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentProject = projects.find((p) => p.slug === currentSlug);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(slug: string) {
    setOpen(false);
    window.location.href = `https://${slug}.syntance.dev/dashboard`;
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-background/50"
      >
        <div className="text-left">
          <p className="text-sm font-medium">{currentProject?.name}</p>
          <p className="text-xs text-muted-foreground">
            {currentSlug}.syntance.dev
          </p>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-xl border border-border bg-card p-2 shadow-xl">
          <p className="mb-2 px-2 text-xs font-medium text-muted-foreground">
            Wszystkie projekty ({projects.length})
          </p>
          <div className="max-h-80 overflow-y-auto">
            {projects.map((project) => (
              <button
                key={project.slug}
                onClick={() => handleSelect(project.slug)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-background/50"
              >
                <div
                  className={`h-2 w-2 rounded-full ${STATUS_COLORS[project.status] || "bg-gray-500"}`}
                />
                <div className="flex-1 overflow-hidden">
                  <p className="truncate text-sm font-medium">{project.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {project.slug}.syntance.dev
                  </p>
                </div>
                {project.slug === currentSlug && (
                  <Check className="h-4 w-4 text-accent-light" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
