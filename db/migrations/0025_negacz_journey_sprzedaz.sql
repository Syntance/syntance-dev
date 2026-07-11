-- 0025 — Logika Negacza: kręgosłup podróży zakupowej + warstwa sprzedaży.
-- Idempotentna (IF NOT EXISTS) — bezpieczna do wielokrotnego uruchomienia.
-- Uruchamianie: npx tsx --env-file=.env.local scripts/run-sql.ts db/migrations/0025_negacz_journey_sprzedaz.sql

-- 1. purchase_stages — scalenie pól z buyer_journey_stages + kryterium wyjścia + ownerSide
ALTER TABLE "purchase_stages" ADD COLUMN IF NOT EXISTS "client_does_md" text;
ALTER TABLE "purchase_stages" ADD COLUMN IF NOT EXISTS "our_action_md" text;
ALTER TABLE "purchase_stages" ADD COLUMN IF NOT EXISTS "time_hint" varchar(100);
ALTER TABLE "purchase_stages" ADD COLUMN IF NOT EXISTS "exit_criterion" text;
ALTER TABLE "purchase_stages" ADD COLUMN IF NOT EXISTS "owner_side" varchar(10) NOT NULL DEFAULT 'marketing';

-- 2. sales_activities — proces sprzedaży zmapowany na etapy zakupu
CREATE TABLE IF NOT EXISTS "sales_activities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "stage_id" uuid NOT NULL REFERENCES "purchase_stages"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "type" varchar(50),
  "notes_md" text,
  "tools_md" text,
  "order_idx" integer DEFAULT 0,
  "status" varchar(30) DEFAULT 'planned',
  "review_flag" boolean NOT NULL DEFAULT false,
  "deleted_at" timestamp
);
CREATE INDEX IF NOT EXISTS "sales_activities_stage_idx" ON "sales_activities" ("stage_id");

-- 3. stage_id na encjach planujących per faza (expand; stare varchar `stage` zostaje do fazy contract)
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "stage_id" uuid REFERENCES "purchase_stages"("id") ON DELETE SET NULL;
ALTER TABLE "channel_activity_plan" ADD COLUMN IF NOT EXISTS "stage_id" uuid REFERENCES "purchase_stages"("id") ON DELETE SET NULL;
ALTER TABLE "geo_queries" ADD COLUMN IF NOT EXISTS "stage_id" uuid REFERENCES "purchase_stages"("id") ON DELETE SET NULL;
