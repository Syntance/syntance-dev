ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "hourly_rate_development" real;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "hourly_rate_maintenance" real;

UPDATE "projects"
SET
  hourly_rate_development = COALESCE(hourly_rate_development, hourly_rate),
  hourly_rate_maintenance = COALESCE(hourly_rate_maintenance, hourly_rate)
WHERE hourly_rate IS NOT NULL;
