ALTER TABLE "time_entries" ADD COLUMN IF NOT EXISTS "work_type" varchar(20) NOT NULL DEFAULT 'development';
