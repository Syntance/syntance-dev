-- ─── Kolor tekstu i edycja kolumn konkurentów ────────────────────────────────
--
-- Dokłada kolor wyświetlanego tekstu per kolumna (paleta jak przy opcjach
-- select). Przesuwanie i edycja typu/etykiety/opcji nie wymagają zmian
-- schematu — działają na już istniejących kolumnach (label/type/options/
-- order_idx), tylko przez nowy PATCH w warstwie API.

ALTER TABLE "competitor_columns" ADD COLUMN IF NOT EXISTS "text_color" varchar(20);
