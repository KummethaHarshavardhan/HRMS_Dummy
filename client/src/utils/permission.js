export const normalizeRole = (role) => {
  if (!role) return "";
  const r = String(role).trim().toLowerCase();
  if (r === "super_admin" || r === "superadmin" || r === "super admin") return "super_admin";
  if (r === "admin") return "admin";
  if (
    r === "hr" ||
    r === "hr manager" ||
    r === "hr_manager" ||
    r === "human resources" ||
    r === "human_resources"
  ) {
    return "hr_manager";
  }
  if (r === "employee") return "employee";
  return r;
};

const permissions = {
  super_admin: [
    "super_admin_dashboard",
    "organizations",
    "super_admin_hr",
    "organization_usage",
    "leave",
    "payroll",
    "super_admin_payroll",
    "profile",
    "holidays",
    "wfh_requests",
  ],

  admin: [
    "dashboard",
    "profile",
    "employee",
    "attendance",
    "leave",
    "payroll",
    "reports",
    "settings",
    "users",
    "documents",
    "onboarding",
    "offboarding",
    "holidays",
    "assets",
    "shifts",
    "wfh_requests",
  ],

  hr_manager: [
    "dashboard",
    "profile",
    "employee",
    "attendance",
    "leave",
    "payroll",
    "reports",
    "settings",
    "documents",
    "onboarding",
    "offboarding",
    "holidays",
    "assets",
    "shifts",
    "wfh_requests",
  ],

  employee: [
    "dashboard",
    "profile",
    "employee",
    "attendance",
    "leave",
    "payroll",
    "tasks",
    "progress",
    "submissions",
    "reports",
    "settings",
    "documents",
    "onboarding",
    "holidays",
    "assets",
  ],
};

export const canAccessFeature = (role, feature) => {
  if (!role) return false;
  const normalizedRole = normalizeRole(role);
  return permissions[normalizedRole]?.includes(feature) || false;
};