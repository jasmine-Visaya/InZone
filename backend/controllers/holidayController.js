const pool = require("../src/config/database");
const { isValidDate, getHolidaysBetween } = require("../utils/holidays");

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

const SELECT_COLUMNS = `
  id,
  TO_CHAR(holiday_date, 'YYYY-MM-DD') AS date,
  name,
  type,
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
    const result = await pool.query(
      `INSERT INTO holidays (holiday_date, name, type, created_by)
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
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ success: false, message: "Invalid holiday ID." });
  }

  const input = readHolidayBody(req.body);
  if (input.error) return res.status(400).json({ success: false, message: input.error });

  try {
    const result = await pool.query(
      `UPDATE holidays
       SET holiday_date = $1::date, name = $2, type = $3, updated_at = NOW()
       WHERE id = $4
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
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ success: false, message: "Invalid holiday ID." });
  }

  try {
    const result = await pool.query(`DELETE FROM holidays WHERE id = $1 RETURNING id`, [id]);

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
