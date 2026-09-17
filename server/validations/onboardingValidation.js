export const validateCreateOnboarding = (req, res, next) => {
  const { employee_id } = req.body;

  if (!employee_id) {
    return res.status(400).json({
      success: false,
      message: "employee_id is required.",
    });
  }

  next();
};

export const validateUpdateChecklistItem = (req, res, next) => {
  const { status } = req.body;

  if (status && !["Pending", "In Progress", "Done"].includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Status must be one of: Pending, In Progress, Done",
    });
  }

  next();
};
