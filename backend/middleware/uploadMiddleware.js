
const multer = require("multer");

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: (req, file, callback) => {
        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];

        if (allowedTypes.includes(file.mimetype)) {
            callback(null, true);
        } else {
            callback(
                new Error("Only JPEG, PNG, and WEBP images are allowed.")
            );
        }
    }
});

// Handle photo upload errors before the controller runs
const uploadPhoto = (req, res, next) => {
    upload.single("photo")(req, res, (error) => {
        if (!error) {
            return next();
        }

        if (error instanceof multer.MulterError) {
            if (error.code === "LIMIT_FILE_SIZE") {
                return res.status(413).json({
                    success: false,
                    message: "Photo must not exceed 5 MB."
                });
            }

            return res.status(400).json({
                success: false,
                message: "Photo upload failed. Please try again."
            });
        }

        return res.status(400).json({
            success: false,
            message: error.message ||
                "Invalid photo. Please upload a supported image."
        });
    });
};

module.exports = uploadPhoto;