export const validateCreateOffboarding = (req, res, next) => {
  const { employee_id, resignation_date, last_working_day } = req.body;

  if (!employee_id) {
    return res.status(400).json({
      success: false,
      message: "employee_id is required.",
    });
  }

  if (!resignation_date) {
    return res.status(400).json({
      success: false,
      message: "resignation_date is required.",
    });
  }

  if (!last_working_day) {
    return res.status(400).json({
      success: false,
      message: "last_working_day is required.",
    });
  }

  if (new Date(last_working_day) < new Date(resignation_date)) {
    return res.status(400).json({
      success: false,
      message: "last_working_day cannot precede resignation_date.",
    });
  }

  next();
};

export const validateClearanceSignOff = (req, res, next) => {
  const { department, signed } = req.body;
  const validDepartments = ["hr", "it", "finance", "manager"];

  if (!department || !validDepartments.includes(String(department).toLowerCase())) {
    return res.status(400).json({
      success: false,
      message: `department is required and must be one of: ${validDepartments.join(", ")}`,
    });
  }

  if (signed === undefined || typeof signed !== "boolean") {
    return res.status(400).json({
      success: false,
      message: "signed (boolean) is required.",
    });
  }

  next();
};
