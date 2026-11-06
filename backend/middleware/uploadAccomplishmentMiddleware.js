const multer = require("multer");
const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
const uploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
  fileFilter(req, file, cb) {
    if (!allowed.has(file.mimetype)) return cb(new Error("JPG, PNG, or WEBP images only."));
    cb(null, true);
  },
}).array("photos", 10);
module.exports = (req, res, next) => uploader(req, res, (error) => {
  if (error) return res.status(400).json({ success: false, message: error.message });
  next();
});
