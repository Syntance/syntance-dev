# Syntance Client Portal

Portal kliencki na `syntance.dev` — każdy klient ma subdomenę `[nazwa].syntance.dev` z podglądem projektu, statusem realizacji i feedbackiem.

## Stack

- **Next.js 16** (App Router, Turbopack)
- **TypeScript** + **Tailwind CSS v4**
- **Sanity CMS** — zarządzanie projektami (embedded Studio na `/studio`)
- **Prisma 7** + PostgreSQL — auth klientów, feedback
- **Resend** — emaile (reset hasła, setup konta)
- **JWT** — sesje

## Architektura

```
Sanity Studio (/studio)         PostgreSQL (Prisma)
┌─────────────────────┐         ┌────────────────────┐
│  Projekty           │         │  ClientUser         │
│  - slug (subdomena) │         │  - email + hasło    │
│  - clientEmail      │         │  AdminUser          │
│  - previewUrl       │         │  Feedback           │
│  - status           │         │  PasswordResetToken │
└─────────────────────┘         └────────────────────┘
```

**Projekty** zarządzasz w Sanity Studio. **Klienci** logują się emailem + hasłem (konto w PostgreSQL).

## Szybki start

### 1. Zainstaluj zależności

```bash
npm install
```

### 2. Skonfiguruj zmienne środowiskowe

```bash
cp .env.example .env
```

Uzupełnij:
- `DATABASE_URL` — PostgreSQL (Supabase / Neon / Vercel Postgres)
- `NEXT_PUBLIC_SANITY_PROJECT_ID` — z [sanity.io/manage](https://www.sanity.io/manage)
- `RESEND_API_KEY` — z [resend.com](https://resend.com)
- `JWT_SECRET` — losowy string

### 3. Baza danych

```bash
npx prisma migrate dev --name init
npx prisma generate
npm run db:seed
```

Seed tworzy:
- **Admin**: `admin@syntance.com` / `admin123`
- **Klient testowy**: `klient@example.com` / `klient123`

### 4. Sanity

Stwórz projekt na [sanity.io/manage](https://www.sanity.io/manage), wklej `projectId` do `.env`.

Odpal dev server i wejdź na `localhost:3000/studio` — dodaj pierwszy projekt z emailem klienta.

### 5. Dev server

```bash
npm run dev
```

## Flow

### Onboarding klienta

1. **Ty** (admin): tworzysz projekt w Sanity Studio — wpisujesz slug, previewUrl, email klienta
2. Klient wchodzi na `[slug].syntance.dev/login`
3. Pierwsze logowanie: klient klika "Ustaw hasło" → podaje email → dostaje link emailem → ustawia hasło
4. Kolejne logowania: email + hasło
5. Zapomniał hasła: "Zapomniałem hasła" → email z linkiem → nowe hasło

### Dashboard klienta

- **Podgląd** — live preview strony (iframe)
- **Status** — wizualny pasek postępu (Projektowanie → Development → QA → Review → Live)
- **Feedback** — formularz do komunikacji

### Panel admina (`/admin`)

- Widok projektów z Sanity (read-only)
- Statystyki: projekty, klienci, feedback
- Feedback klientów
- Link do Sanity Studio

## Ścieżki

| Ścieżka | Opis |
|---|---|
| `/` | Landing |
| `/login` | Logowanie (email + hasło) |
| `/set-password` | Ustawienie hasła (pierwsze logowanie) |
| `/forgot-password` | Żądanie resetu hasła |
| `/reset-password` | Formularz nowego hasła |
| `/dashboard` | Dashboard z preview + status |
| `/dashboard/preview` | Pełnoekranowy podgląd |
| `/dashboard/status` | Szczegółowy status |
| `/dashboard/feedback` | Feedback |
| `/admin` | Panel admina |
| `/studio` | Sanity Studio (embedded) |

## Deploy na Vercel

1. Podłącz repo
2. Zmienne: `DATABASE_URL`, `JWT_SECRET`, `NEXT_PUBLIC_SANITY_PROJECT_ID`, `RESEND_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_APP_URL`
3. Wildcard domain: `*.syntance.dev`
4. Deploy

### Resend — konfiguracja domeny

W panelu Resend dodaj domenę `syntance.dev` i zweryfikuj DNS, żeby emaile nie trafiały do spamu.
