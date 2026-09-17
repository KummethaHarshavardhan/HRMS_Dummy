export const validateCreateWFHRequest = (req, res, next) => {
  const { reason, start_date, end_date } = req.body;

  if (!reason || typeof reason !== "string" || !reason.trim()) {
    return res.status(400).json({
      success: false,
      message: "Reason for Work From Home is required.",
    });
  }

  if (!start_date || isNaN(new Date(start_date).getTime())) {
    return res.status(400).json({
      success: false,
      message: "A valid start_date is required.",
    });
  }

  if (!end_date || isNaN(new Date(end_date).getTime())) {
    return res.status(400).json({
      success: false,
      message: "A valid end_date is required.",
    });
  }

  const start = new Date(start_date);
  const end = new Date(end_date);

  // Normalize to dates ignoring time
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  if (end.getTime() < start.getTime()) {
    return res.status(400).json({
      success: false,
      message: "end_date cannot be earlier than start_date.",
    });
  }

  next();
};

export const validateDecideWFHRequest = (req, res, next) => {
  const { decision, rejection_reason } = req.body;

  if (!decision || !["Approved", "Rejected"].includes(decision)) {
    return res.status(400).json({
      success: false,
      message: "Decision must be either 'Approved' or 'Rejected'.",
    });
  }

  if (
    decision === "Rejected" &&
    (!rejection_reason || typeof rejection_reason !== "string" || !rejection_reason.trim())
  ) {
    return res.status(400).json({
      success: false,
      message: "A rejection reason is required when rejecting a WFH request.",
    });
  }

  next();
};
