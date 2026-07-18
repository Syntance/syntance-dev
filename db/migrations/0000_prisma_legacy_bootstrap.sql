-- Bootstrap tabel ery Prismy (ClientUser/AdminUser/PasswordResetToken) dla
-- ŚWIEŻEJ bazy (CI, restore drill). Na działających bazach tabele istnieją od
-- dawna (utworzone przez Prisma — patrz komentarz w 0017) i IF NOT EXISTS nic
-- nie robi. Kolumny workspace_id/role/purpose dokłada 0020_team_multi_seat.sql.
-- Kształt bazowy zgodny z deklaracjami Drizzle w db/schema.ts.

CREATE TABLE IF NOT EXISTS "ClientUser" (
  "id" text PRIMARY KEY,
  "email" text NOT NULL UNIQUE,
  "name" text,
  "passwordHash" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "AdminUser" (
  "id" text PRIMARY KEY,
  "email" text NOT NULL UNIQUE,
  "passwordHash" text NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
  "id" text PRIMARY KEY,
  "email" text NOT NULL,
  "token" text NOT NULL UNIQUE,
  "expiresAt" timestamp NOT NULL,
  "used" boolean DEFAULT false NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
