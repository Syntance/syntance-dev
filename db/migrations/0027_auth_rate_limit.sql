-- 0027 — rate limit fixed-window dla endpointów auth (login, request-reset,
-- request-setup). Idempotentna (IF NOT EXISTS) — konwencja repo.

CREATE TABLE IF NOT EXISTS "auth_rate_limits" (
  "key" text PRIMARY KEY,
  "window_start" timestamp DEFAULT now() NOT NULL,
  "count" integer DEFAULT 0 NOT NULL
);
