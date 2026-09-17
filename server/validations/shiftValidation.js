import mongoose from "mongoose";

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const HEX_COLOR_REGEX = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

export const validateCreateShift = (req, res, next) => {
  const { name, start_time, end_time, color } = req.body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({
      success: false,
      message: "Shift name is required.",
    });
  }

  if (!start_time || !TIME_REGEX.test(start_time.trim())) {
    return res.status(400).json({
      success: false,
      message: "Valid start_time in HH:mm 24-hour format is required (e.g., '09:00', '22:00').",
    });
  }

  if (!end_time || !TIME_REGEX.test(end_time.trim())) {
    return res.status(400).json({
      success: false,
      message: "Valid end_time in HH:mm 24-hour format is required (e.g., '18:00', '06:00').",
    });
  }

  if (start_time.trim() === end_time.trim()) {
    return res.status(400).json({
      success: false,
      message: "start_time and end_time cannot be identical (a shift must have a duration).",
    });
  }

  if (color && !HEX_COLOR_REGEX.test(color.trim())) {
    return res.status(400).json({
      success: false,
      message: "color must be a valid hex color code (e.g., '#4f46e5').",
    });
  }

  next();
};

export const validateUpdateShift = (req, res, next) => {
  const { name, start_time, end_time, color } = req.body;

  if (name !== undefined && (!name || typeof name !== "string" || !name.trim())) {
    return res.status(400).json({
      success: false,
      message: "Shift name cannot be empty.",
    });
  }

  if (start_time !== undefined && !TIME_REGEX.test(start_time.trim())) {
    return res.status(400).json({
      success: false,
      message: "Valid start_time in HH:mm 24-hour format is required.",
    });
  }

  if (end_time !== undefined && !TIME_REGEX.test(end_time.trim())) {
    return res.status(400).json({
      success: false,
      message: "Valid end_time in HH:mm 24-hour format is required.",
    });
  }

  if (
    start_time !== undefined &&
    end_time !== undefined &&
    start_time.trim() === end_time.trim()
  ) {
    return res.status(400).json({
      success: false,
      message: "start_time and end_time cannot be identical.",
    });
  }

  if (color && !HEX_COLOR_REGEX.test(color.trim())) {
    return res.status(400).json({
      success: false,
      message: "color must be a valid hex color code.",
    });
  }

  next();
};

export const validateCreateShiftGroup = (req, res, next) => {
  const { name, shift_id, employee_ids } = req.body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({
      success: false,
      message: "Shift group name is required.",
    });
  }

  if (!shift_id || !mongoose.Types.ObjectId.isValid(shift_id)) {
    return res.status(400).json({
      success: false,
      message: "A valid shift_id is required.",
    });
  }

  if (employee_ids !== undefined) {
    if (!Array.isArray(employee_ids)) {
      return res.status(400).json({
        success: false,
        message: "employee_ids must be an array of employee IDs.",
      });
    }

    const invalidId = employee_ids.find((id) => !mongoose.Types.ObjectId.isValid(id));
    if (invalidId) {
      return res.status(400).json({
        success: false,
        message: `Invalid employee ID in employee_ids: ${invalidId}`,
      });
    }
  }

  next();
};

export const validateAssignShift = (req, res, next) => {
  const { shift_id } = req.body;

  if (!shift_id || !mongoose.Types.ObjectId.isValid(shift_id)) {
    return res.status(400).json({
      success: false,
      message: "A valid shift_id is required.",
    });
  }

  next();
};
