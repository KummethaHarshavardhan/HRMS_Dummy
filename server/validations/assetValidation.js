import { ASSET_TYPES, ASSET_STATUSES, ASSET_CONDITIONS } from "../models/Asset.js";

export const validateCreateAsset = (req, res, next) => {
  const { asset_tag, type, brand, model, status, condition } = req.body;

  if (!asset_tag || !asset_tag.trim()) {
    return res.status(400).json({
      success: false,
      message: "asset_tag is required (e.g. AST0001).",
    });
  }

  if (!type || !ASSET_TYPES.includes(type)) {
    return res.status(400).json({
      success: false,
      message: `type is required and must be one of: ${ASSET_TYPES.join(", ")}`,
    });
  }

  if (!brand || !brand.trim()) {
    return res.status(400).json({
      success: false,
      message: "brand is required.",
    });
  }

  if (!model || !model.trim()) {
    return res.status(400).json({
      success: false,
      message: "model is required.",
    });
  }

  if (status && !ASSET_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `status must be one of: ${ASSET_STATUSES.join(", ")}`,
    });
  }

  if (condition && !ASSET_CONDITIONS.includes(condition)) {
    return res.status(400).json({
      success: false,
      message: `condition must be one of: ${ASSET_CONDITIONS.join(", ")}`,
    });
  }

  next();
};

export const validateAssignAsset = (req, res, next) => {
  const { asset_id, employee_id } = req.body;

  if (!asset_id) {
    return res.status(400).json({
      success: false,
      message: "asset_id is required.",
    });
  }

  if (!employee_id) {
    return res.status(400).json({
      success: false,
      message: "employee_id is required.",
    });
  }

  next();
};

export const validateReturnAsset = (req, res, next) => {
  const { assignment_id, asset_id, return_condition } = req.body;

  if (!assignment_id && !asset_id) {
    return res.status(400).json({
      success: false,
      message: "Either assignment_id or asset_id is required to process return.",
    });
  }

  if (return_condition && !ASSET_CONDITIONS.includes(return_condition)) {
    return res.status(400).json({
      success: false,
      message: `return_condition must be one of: ${ASSET_CONDITIONS.join(", ")}`,
    });
  }

  next();
};
