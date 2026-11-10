-- =====================================================================
-- InZone enhancement: holidays, overtime approval, weekly report data
-- Run once in the Supabase SQL editor. Safe to re-run.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. HOLIDAYS
-- Admin-managed. Used by:
--   * weekly report unlock rule (last working day of the week)
--   * Loui's holiday check on time in / time out (attendanceController)
-- holiday_type:
--   REGULAR              regular holiday
--   SPECIAL_NON_WORKING  special (non-working) day
--   SUSPENSION           sudden work/class suspension (weather, etc.)
--   LOCAL                city/provincial holiday (e.g. Puerto Princesa)
-- (holiday_type values, set from the admin Holidays page)
-- ---------------------------------------------------------------------
-- Column names match Loui's attendance code (holiday_name, holiday_type).
-- If the table was already created in Supabase, only the missing columns
-- are added and existing rows are kept.
CREATE TABLE IF NOT EXISTS holidays (
  id           BIGSERIAL PRIMARY KEY,
  holiday_date DATE NOT NULL,
  holiday_name TEXT NOT NULL,
  holiday_type TEXT NOT NULL DEFAULT 'REGULAR'
);

ALTER TABLE holidays
  ADD COLUMN IF NOT EXISTS holiday_type TEXT DEFAULT 'REGULAR',
  ADD COLUMN IF NOT EXISTS created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- The existing table may already have its own CHECK rule on holiday_type
-- (this is what rejected the first run). Drop any such rule, convert the
-- existing types to the ones the admin page uses, then add a matching rule.
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'holidays'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%holiday_type%'
  LOOP
    EXECUTE format('ALTER TABLE holidays DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

UPDATE holidays
SET holiday_type = CASE
  WHEN holiday_type IN ('REGULAR', 'SPECIAL_NON_WORKING', 'SUSPENSION', 'LOCAL')
    THEN holiday_type
  WHEN holiday_type ILIKE '%special%' OR holiday_type ILIKE '%non%'
    THEN 'SPECIAL_NON_WORKING'
  WHEN holiday_type ILIKE '%susp%'
    THEN 'SUSPENSION'
  WHEN holiday_type ILIKE '%local%'
    THEN 'LOCAL'
  ELSE 'REGULAR'
END
WHERE holiday_type IS NULL
   OR holiday_type NOT IN ('REGULAR', 'SPECIAL_NON_WORKING', 'SUSPENSION', 'LOCAL');

ALTER TABLE holidays
  ADD CONSTRAINT holidays_holiday_type_check
  CHECK (holiday_type IN ('REGULAR', 'SPECIAL_NON_WORKING', 'SUSPENSION', 'LOCAL'));

-- 2026 national holidays, Proclamation No. 1006 (s. 2025).
-- Eid'l Fitr / Eid'l Adha are declared separately: add them in the admin
-- Holidays page once announced. Feb 25 (EDSA) is a special WORKING day,
-- so it is intentionally not listed. Dates already in the table are skipped.
INSERT INTO holidays (holiday_date, holiday_name, holiday_type)
SELECT v.holiday_date::date, v.holiday_name, v.holiday_type
FROM (VALUES
  ('2026-01-01', 'New Year''s Day',                     'REGULAR'),
  ('2026-02-17', 'Chinese New Year',                   'SPECIAL_NON_WORKING'),
  ('2026-04-02', 'Maundy Thursday',                    'REGULAR'),
  ('2026-04-03', 'Good Friday',                        'REGULAR'),
  ('2026-04-04', 'Black Saturday',                     'SPECIAL_NON_WORKING'),
  ('2026-04-09', 'Araw ng Kagitingan',                 'REGULAR'),
  ('2026-05-01', 'Labor Day',                          'REGULAR'),
  ('2026-06-12', 'Independence Day',                   'REGULAR'),
  ('2026-08-21', 'Ninoy Aquino Day',                   'SPECIAL_NON_WORKING'),
  ('2026-08-31', 'National Heroes Day',                'REGULAR'),
  ('2026-11-01', 'All Saints'' Day',                   'SPECIAL_NON_WORKING'),
  ('2026-11-02', 'All Souls'' Day',                    'SPECIAL_NON_WORKING'),
  ('2026-11-30', 'Bonifacio Day',                      'REGULAR'),
  ('2026-12-08', 'Feast of the Immaculate Conception', 'SPECIAL_NON_WORKING'),
  ('2026-12-24', 'Christmas Eve',                      'SPECIAL_NON_WORKING'),
  ('2026-12-25', 'Christmas Day',                      'REGULAR'),
  ('2026-12-30', 'Rizal Day',                          'REGULAR'),
  ('2026-12-31', 'Last Day of the Year',               'SPECIAL_NON_WORKING')
) AS v(holiday_date, holiday_name, holiday_type)
WHERE NOT EXISTS (
  SELECT 1 FROM holidays h WHERE h.holiday_date = v.holiday_date::date
);

-- ---------------------------------------------------------------------
-- 2. OVERTIME REVIEW ON ATTENDANCE
-- Overtime itself is NOT stored: it is computed as
--   max(0, (time_out - time_in) - REGULAR_DAILY_HOURS)
-- Only the supervisor's decision is stored. NULL = not reviewed yet.
-- Only APPROVED overtime counts toward required hours.
-- ---------------------------------------------------------------------
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS overtime_status      TEXT
      CHECK (overtime_status IN ('APPROVED', 'REJECTED')),
  ADD COLUMN IF NOT EXISTS overtime_comment     TEXT,
  ADD COLUMN IF NOT EXISTS overtime_reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS overtime_reviewed_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------
-- 3. WEEKLY REPORT DATA SNAPSHOT
-- The week's hours, OT, attendance summary and progress, saved at the
-- moment the student submits, so the supervisor reviews exactly that.
-- ---------------------------------------------------------------------
ALTER TABLE weekly_reports
  ADD COLUMN IF NOT EXISTS summary JSONB;

COMMIT;
