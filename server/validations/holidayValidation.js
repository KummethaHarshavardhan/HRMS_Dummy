import { HOLIDAY_TYPES } from "../models/Holiday.js";

export const validateCreateHoliday = (req, res, next) => {
  const { name, date, type } = req.body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({
      success: false,
      message: "Holiday name is required.",
    });
  }

  if (!date) {
    return res.status(400).json({
      success: false,
      message: "Holiday date is required.",
    });
  }

  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) {
    return res.status(400).json({
      success: false,
      message: "Invalid date format.",
    });
  }

  if (type && !HOLIDAY_TYPES.includes(type)) {
    return res.status(400).json({
      success: false,
      message: `Holiday type must be one of: ${HOLIDAY_TYPES.join(", ")}`,
    });
  }

  next();
};

export const validateBulkHoliday = (req, res, next) => {
  const { holidays } = req.body;

  if (!Array.isArray(holidays) || holidays.length === 0) {
    return res.status(400).json({
      success: false,
      message: "holidays must be a non-empty array of holiday objects.",
    });
  }

  for (let i = 0; i < holidays.length; i++) {
    const h = holidays[i];
    if (!h.name || !h.date) {
      return res.status(400).json({
        success: false,
        message: `Holiday at index ${i} is missing required 'name' or 'date'.`,
      });
    }
  }

  next();
};
