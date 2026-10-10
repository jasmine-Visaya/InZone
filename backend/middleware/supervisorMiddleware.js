
const requireSupervisor = (req, res, next) => {
    if (!req.user || req.user.role !== "SUPERVISOR") {
        return res.status(403).json({
            success: false,
            message: "Access denied. Supervisor access required."
        });
    }

    next();
};

module.exports = requireSupervisor;