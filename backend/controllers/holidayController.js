const pool = require("../src/config/database");
const { isValidDate, getHolidaysBetween } = require("../utils/holidays");

// Holiday ids can be numbers or UUIDs depending on how the table was created.
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readId(value) {
  const id = String(value || "").trim();
  return /^\d+$/.test(id) || UUID_PATTERN.test(id) ? id : null;
}

const HOLIDAY_TYPES = ["REGULAR", "SPECIAL_NON_WORKING", "SUSPENSION", "LOCAL"];

function readHolidayBody(body = {}) {
  const date = String(body.holiday_date || body.date || "").trim();
  const name = String(body.name || "").trim();
  const type = String(body.type || "REGULAR").trim().toUpperCase();

  if (!isValidDate(date)) return { error: "Holiday date must be in YYYY-MM-DD format." };
  if (!name) return { error: "Holiday name is required." };
  if (name.length > 150) return { error: "Holiday name must not exceed 150 characters." };
  if (!HOLIDAY_TYPES.includes(type)) return { error: "Invalid holiday type." };

  return { date, name, type };
}

// One holiday per date (the table may not have a unique constraint).
async function dateTaken(date, exceptId = null) {
  const result = await pool.query(
    `SELECT 1 FROM holidays
     WHERE holiday_date = $1::date
       AND ($2::text IS NULL OR id::text <> $2::text)
     LIMIT 1`,
    [date, exceptId]
  );
  return result.rows.length > 0;
}

const SELECT_COLUMNS = `
  id,
  TO_CHAR(holiday_date, 'YYYY-MM-DD') AS date,
  holiday_name AS name,
  holiday_type AS type,
  created_at,
  updated_at
`;

// =====================================
// LIST HOLIDAYS (any logged-in user)
// GET /api/holidays?year=2026
// GET /api/holidays?from=YYYY-MM-DD&to=YYYY-MM-DD
// =====================================
const listHolidays = async (req, res) => {
  try {
    let from = String(req.query.from || "").trim();
    let to = String(req.query.to || "").trim();

    if (!from || !to) {
      const year = Number(req.query.year) || new Date().getFullYear();
      if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        return res.status(400).json({ success: false, message: "Invalid year." });
      }
      from = `${year}-01-01`;
      to = `${year}-12-31`;
    }

    if (!isValidDate(from) || !isValidDate(to) || from > to) {
      return res.status(400).json({ success: false, message: "Invalid date range." });
    }

    const holidays = await getHolidaysBetween(from, to);

    return res.json({ success: true, from, to, count: holidays.length, holidays });
  } catch (error) {
    console.error("List holidays error:", error);
    return res.status(500).json({ success: false, message: "Unable to load holidays." });
  }
};

// =====================================
// CREATE HOLIDAY (admin)
// POST /api/holidays
// =====================================
const createHoliday = async (req, res) => {
  const input = readHolidayBody(req.body);
  if (input.error) return res.status(400).json({ success: false, message: input.error });

  try {
    if (await dateTaken(input.date)) {
      return res.status(409).json({ success: false, message: "A holiday already exists on that date." });
    }

    const result = await pool.query(
      `INSERT INTO holidays (holiday_date, holiday_name, holiday_type, created_by)
       VALUES ($1::date, $2, $3, $4)
       RETURNING ${SELECT_COLUMNS}`,
      [input.date, input.name, input.type, req.user.id]
    );

    return res.status(201).json({ success: true, message: "Holiday added.", holiday: result.rows[0] });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ success: false, message: "A holiday already exists on that date." });
    }
    console.error("Create holiday error:", error);
    return res.status(500).json({ success: false, message: "Unable to add holiday." });
  }
};

// =====================================
// UPDATE HOLIDAY (admin)
// PUT /api/holidays/:id
// =====================================
const updateHoliday = async (req, res) => {
  const id = readId(req.params.id);
  if (!id) {
    return res.status(400).json({ success: false, message: "Invalid holiday ID." });
  }

  const input = readHolidayBody(req.body);
  if (input.error) return res.status(400).json({ success: false, message: input.error });

  try {
    if (await dateTaken(input.date, id)) {
      return res.status(409).json({ success: false, message: "A holiday already exists on that date." });
    }

    const result = await pool.query(
      `UPDATE holidays
       SET holiday_date = $1::date, holiday_name = $2, holiday_type = $3, updated_at = NOW()
       WHERE id::text = $4::text
       RETURNING ${SELECT_COLUMNS}`,
      [input.date, input.name, input.type, id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: "Holiday not found." });
    }

    return res.json({ success: true, message: "Holiday updated.", holiday: result.rows[0] });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ success: false, message: "A holiday already exists on that date." });
    }
    console.error("Update holiday error:", error);
    return res.status(500).json({ success: false, message: "Unable to update holiday." });
  }
};

// =====================================
// DELETE HOLIDAY (admin)
// DELETE /api/holidays/:id
// =====================================
const deleteHoliday = async (req, res) => {
  const id = readId(req.params.id);
  if (!id) {
    return res.status(400).json({ success: false, message: "Invalid holiday ID." });
  }

  try {
    const result = await pool.query(`DELETE FROM holidays WHERE id::text = $1::text RETURNING id`, [id]);

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: "Holiday not found." });
    }

    return res.json({ success: true, message: "Holiday removed." });
  } catch (error) {
    console.error("Delete holiday error:", error);
    return res.status(500).json({ success: false, message: "Unable to remove holiday." });
  }
};

module.exports = {
  HOLIDAY_TYPES,
  listHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
};
