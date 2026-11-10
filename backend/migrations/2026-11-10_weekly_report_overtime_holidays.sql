-- =====================================================================
-- InZone enhancement: holidays, overtime approval, weekly report data
-- Run once in the Supabase SQL editor. Safe to re-run.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. HOLIDAYS
-- Admin-managed. Used by:
--   * weekly report unlock rule (last working day of the week)
--   * Loui's early time-out rule (utils/holidays.js -> getHoliday)
-- type:
--   REGULAR              regular holiday
--   SPECIAL_NON_WORKING  special (non-working) day
--   SUSPENSION           sudden work/class suspension (weather, etc.)
--   LOCAL                city/provincial holiday (e.g. Puerto Princesa)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS holidays (
  id           BIGSERIAL PRIMARY KEY,
  holiday_date DATE        NOT NULL UNIQUE,
  name         TEXT        NOT NULL,
  type         TEXT        NOT NULL DEFAULT 'REGULAR'
               CHECK (type IN ('REGULAR', 'SPECIAL_NON_WORKING', 'SUSPENSION', 'LOCAL')),
  created_by   UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2026 national holidays, Proclamation No. 1006 (s. 2025).
-- Eid'l Fitr / Eid'l Adha are declared separately: add them in the admin
-- Holidays page once announced. Feb 25 (EDSA) is a special WORKING day,
-- so it is intentionally not listed.
INSERT INTO holidays (holiday_date, name, type) VALUES
  ('2026-01-01', 'New Year''s Day',                         'REGULAR'),
  ('2026-02-17', 'Chinese New Year',                       'SPECIAL_NON_WORKING'),
  ('2026-04-02', 'Maundy Thursday',                        'REGULAR'),
  ('2026-04-03', 'Good Friday',                            'REGULAR'),
  ('2026-04-04', 'Black Saturday',                         'SPECIAL_NON_WORKING'),
  ('2026-04-09', 'Araw ng Kagitingan',                     'REGULAR'),
  ('2026-05-01', 'Labor Day',                              'REGULAR'),
  ('2026-06-12', 'Independence Day',                       'REGULAR'),
  ('2026-08-21', 'Ninoy Aquino Day',                       'SPECIAL_NON_WORKING'),
  ('2026-08-31', 'National Heroes Day',                    'REGULAR'),
  ('2026-11-01', 'All Saints'' Day',                       'SPECIAL_NON_WORKING'),
  ('2026-11-02', 'All Souls'' Day',                        'SPECIAL_NON_WORKING'),
  ('2026-11-30', 'Bonifacio Day',                          'REGULAR'),
  ('2026-12-08', 'Feast of the Immaculate Conception',     'SPECIAL_NON_WORKING'),
  ('2026-12-24', 'Christmas Eve',                          'SPECIAL_NON_WORKING'),
  ('2026-12-25', 'Christmas Day',                          'REGULAR'),
  ('2026-12-30', 'Rizal Day',                              'REGULAR'),
  ('2026-12-31', 'Last Day of the Year',                   'SPECIAL_NON_WORKING')
ON CONFLICT (holiday_date) DO NOTHING;

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
