/**
 * Configurable default checklist templates for employee onboarding and offboarding.
 * HR/Admin can customize tasks or accept these defaults when initiating processes.
 */

export const DEFAULT_ONBOARDING_TASKS = [
  {
    task_name: "Collect & Verify ID and Address Proofs",
    category: "HR",
    status: "Pending",
    notes: "Aadhaar, Passport/Driving License, PAN copy",
  },
  {
    task_name: "Sign Employment Contract & Non-Disclosure Agreement",
    category: "HR",
    status: "Pending",
    notes: "Ensure signed copies are archived in documents tab",
  },
  {
    task_name: "Provision Corporate Email & System Access Accounts",
    category: "IT",
    status: "Pending",
    notes: "Create GSuite/Outlook account and grant SSO access",
  },
  {
    task_name: "Allocate Laptop & Workstation Hardware",
    category: "IT",
    status: "Pending",
    notes: "Assign in Asset Management module",
  },
  {
    task_name: "Issue Corporate ID Card & Physical Access Badge",
    category: "Admin",
    status: "Pending",
    notes: "Building and floor door access clearance",
  },
  {
    task_name: "Bank Account & Direct Deposit Payroll Setup",
    category: "Finance",
    status: "Pending",
    notes: "Verify bank IFSC, account number, and PAN linkage",
  },
  {
    task_name: "Team Orientation & Reporting Manager Introduction",
    category: "HR",
    status: "Pending",
    notes: "Welcome lunch and introduction to project leads",
  },
];

export const DEFAULT_OFFBOARDING_TASKS = [
  {
    task_name: "Knowledge Transfer & Documentation Handover",
    category: "HR",
    status: "Pending",
    notes: "Ensure replacement or team lead signs off on KT completion",
  },
  {
    task_name: "Return Laptop, Chargers & IT Peripherals",
    category: "IT",
    status: "Pending",
    notes: "Mark returned in Asset Management",
  },
  {
    task_name: "Revoke Corporate Email, VPN & Cloud Access",
    category: "IT",
    status: "Pending",
    notes: "Disable Google/Microsoft account and reset shared credentials",
  },
  {
    task_name: "Return Company ID, Access Keycard & Parking Pass",
    category: "Admin",
    status: "Pending",
    notes: "Deactivate access badge in security logs",
  },
  {
    task_name: "Conduct Confidential HR Exit Interview",
    category: "HR",
    status: "Pending",
    notes: "Document feedback, reasons for leaving, and suggestions",
  },
  {
    task_name: "Final Salary Settlement & Gratuity Calculation",
    category: "Finance",
    status: "Pending",
    notes: "Include unavailed leave encashment and loan adjustments",
  },
  {
    task_name: "Issue Official Relieving Letter & Experience Certificate",
    category: "HR",
    status: "Pending",
    notes: "Upload final signed certificates to Employee Documents",
  },
];
