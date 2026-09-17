import { DOCUMENT_CATEGORIES, DOCUMENT_STATUSES } from "../models/Document.js";

export const validateDocumentUpload = (req, res, next) => {
  const { employee_id, category, expiry_date } = req.body;

  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "No document file uploaded. Please select a valid file.",
    });
  }

  if (!employee_id) {
    return res.status(400).json({
      success: false,
      message: "employee_id is required.",
    });
  }

  if (!category || !DOCUMENT_CATEGORIES.includes(category)) {
    return res.status(400).json({
      success: false,
      message: `Category is required and must be one of: ${DOCUMENT_CATEGORIES.join(", ")}`,
    });
  }

  if (expiry_date) {
    const d = new Date(expiry_date);
    if (isNaN(d.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid expiry_date format. Must be a valid date.",
      });
    }
  }

  next();
};

export const validateDocumentUpdate = (req, res, next) => {
  const { category, expiry_date, status } = req.body;

  if (category && !DOCUMENT_CATEGORIES.includes(category)) {
    return res.status(400).json({
      success: false,
      message: `Invalid category. Must be one of: ${DOCUMENT_CATEGORIES.join(", ")}`,
    });
  }

  if (status && !DOCUMENT_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Must be one of: ${DOCUMENT_STATUSES.join(", ")}`,
    });
  }

  if (expiry_date !== undefined && expiry_date !== null && expiry_date !== "") {
    const d = new Date(expiry_date);
    if (isNaN(d.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid expiry_date format. Must be a valid date.",
      });
    }
  }

  next();
};
