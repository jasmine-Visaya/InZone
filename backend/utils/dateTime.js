const { DateTime } = require("luxon");

const PHILIPPINES_TIMEZONE = "Asia/Manila";

const getPhilippineDate = () => {
    return DateTime.now()
        .setZone(PHILIPPINES_TIMEZONE)
        .toFormat("yyyy-MM-dd");
};

module.exports = {
    getPhilippineDate
};