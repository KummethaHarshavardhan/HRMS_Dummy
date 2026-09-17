import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { canAccessFeature, normalizeRole } from "../../utils/permission.js";
import {
  FiGrid,
  FiUser,
  FiUsers,
  FiClock,
  FiCalendar,
  FiDollarSign,
  FiBarChart2,
  FiShield,
  FiSettings,
  FiLogOut,
  FiLayers,
  FiCheckSquare,
  FiTrendingUp,
  FiFileText,
  FiCheckCircle,
  FiUserCheck,
  FiSun,
  FiBox,
  FiUserMinus,
  FiHome,
} from "react-icons/fi";

import "./Sidebar.css";

const menuItems = [
  { label: "Dashboard", to: "/dashboard", feature: "dashboard", icon: <FiGrid size={18} /> },
  { label: "Profile", to: "/profile", feature: "profile", icon: <FiUser size={18} /> },
  { label: "Directory", to: "/directory", feature: "employee", icon: <FiUsers size={18} /> },
  { label: "Attendance", to: "/attendance-dashboard", feature: "attendance", icon: <FiClock size={18} /> },
  { label: "Leave Management", to: "/leave", feature: "leave", icon: <FiCalendar size={18} /> },
  { label: "Holiday Calendar", to: "/holidays", feature: "holidays", icon: <FiSun size={18} /> },
  { label: "Asset Management", to: "/assets", feature: "assets", icon: <FiBox size={18} /> },
  { label: "Shifts & Timings", to: "/shifts", feature: "shifts", icon: <FiClock size={18} /> },
  { label: "WFH Requests", to: "/wfh-requests", feature: "wfh_requests", icon: <FiHome size={18} /> },
  { label: "Document Verification", to: "/hr/document-verification", feature: "documents", icon: <FiFileText size={18} /> },
  { label: "Onboarding", to: "/onboarding", feature: "onboarding", icon: <FiUserCheck size={18} /> },
  { label: "Offboarding", to: "/offboarding", feature: "offboarding", icon: <FiUserMinus size={18} /> },
  { label: "Payroll", to: "/payroll", feature: "payroll", icon: <FiDollarSign size={18} /> },
  { label: "Reports", to: "/reports", feature: "reports", icon: <FiBarChart2 size={18} /> },
  { label: "Users", to: "/users", feature: "users", icon: <FiShield size={18} /> },
  { label: "Settings", to: "/settings", feature: "settings", icon: <FiSettings size={18} /> },
];

const superAdminMenuItems = [
  { label: "Dashboard", to: "/super-admin/dashboard", icon: <FiGrid size={18} /> },
  { label: "Organizations", to: "/super-admin/organizations", icon: <FiLayers size={18} /> },
  { label: "HR Management", to: "/super-admin/hr-management", icon: <FiUsers size={18} /> },
  { label: "Organization Usage/Limits", to: "/super-admin/usage-limits", icon: <FiBarChart2 size={18} /> },
  { label: "Leave Management", to: "/leave", icon: <FiCalendar size={18} /> },
  { label: "Holiday Calendar", to: "/holidays", icon: <FiSun size={18} /> },
  { label: "Document Verification", to: "/super-admin/document-verification", icon: <FiFileText size={18} /> },
  { label: "WFH Requests", to: "/super-admin/wfh-requests", icon: <FiHome size={18} /> },
  { label: "Payroll", to: "/super-admin/payroll", icon: <FiDollarSign size={18} /> },
  { label: "Profile", to: "/profile", icon: <FiUser size={18} /> },
];

// Dedicated HR Task Monitoring & Workforce Menu Sections
const hrMenuSections = [
  {
    title: "OVERVIEW",
    items: [
      { label: "Dashboard", to: "/dashboard", icon: <FiGrid size={18} /> },
    ],
  },
  {
    title: "HR OPERATIONS",
    items: [
      { label: "Shifts & Timings", to: "/shifts", icon: <FiClock size={18} /> },
      { label: "WFH Requests", to: "/wfh-requests", icon: <FiHome size={18} /> },
      { label: "Document Verification", to: "/hr/document-verification", icon: <FiFileText size={18} /> },
      { label: "Onboarding", to: "/onboarding", icon: <FiUserCheck size={18} /> },
      { label: "Offboarding", to: "/offboarding", icon: <FiUserMinus size={18} /> },
      { label: "Holiday Calendar", to: "/holidays", icon: <FiSun size={18} /> },
      { label: "Asset Management", to: "/assets", icon: <FiBox size={18} /> },
    ],
  },
  {
    title: "TASK MONITORING",
    items: [
      { label: "Candidates", to: "/hr/candidates", icon: <FiUserCheck size={18} /> },
      { label: "Task Allocation", to: "/hr/tasks", icon: <FiCheckSquare size={18} /> },
      { label: "Progress Tracking", to: "/hr/progress", icon: <FiTrendingUp size={18} /> },
      { label: "Submissions", to: "/hr/submissions", icon: <FiFileText size={18} /> },
      { label: "Review Queue", to: "/hr/reviews", icon: <FiCheckCircle size={18} /> },
    ],
  },
  {
    title: "WORKFORCE",
    items: [
      { label: "Directory", to: "/directory", icon: <FiUsers size={18} /> },
      { label: "Attendance", to: "/attendance-dashboard", icon: <FiClock size={18} /> },
      { label: "Leave Management", to: "/leave", icon: <FiCalendar size={18} /> },
      { label: "Payroll", to: "/payroll", icon: <FiDollarSign size={18} /> },
    ],
  },
  {
    title: "ANALYTICS",
    items: [
      { label: "Reports & Analytics", to: "/hr/reports", icon: <FiBarChart2 size={18} /> },
      { label: "Workforce Reports", to: "/reports", icon: <FiFileText size={18} /> },
    ],
  },
  {
    title: "ACCOUNT",
    items: [
      { label: "My Profile", to: "/profile", icon: <FiUser size={18} /> },
      { label: "Settings", to: "/settings", icon: <FiSettings size={18} /> },
    ],
  },
];

// Dedicated Employee Task Monitoring & Self-Service Menu Sections
const employeeMenuSections = [
  {
    title: "OVERVIEW",
    items: [
      { label: "Dashboard", to: "/dashboard", icon: <FiGrid size={18} /> },
    ],
  },
  {
    title: "SELF SERVICE",
    items: [
      { label: "Directory", to: "/directory", icon: <FiUsers size={18} /> },
      { label: "Attendance", to: "/attendance-dashboard", icon: <FiClock size={18} /> },
      { label: "Leave Management", to: "/leave", icon: <FiCalendar size={18} /> },
      { label: "Holiday Calendar", to: "/holidays", icon: <FiSun size={18} /> },
      { label: "My Onboarding", to: "/employee/onboarding", icon: <FiUserCheck size={18} /> },
      { label: "My Offboarding", to: "/employee/offboarding", icon: <FiUserMinus size={18} /> },
      { label: "WFH Requests", to: "/wfh-requests", icon: <FiHome size={18} /> },
      { label: "Payroll", to: "/payroll", icon: <FiDollarSign size={18} /> },
    ],
  },
  {
    title: "TASK MONITORING",
    items: [
      { label: "My Assigned Tasks", to: "/employee/tasks", icon: <FiCheckSquare size={18} /> },
      { label: "Progress Tracking", to: "/employee/progress", icon: <FiTrendingUp size={18} /> },
      { label: "Submit Work", to: "/employee/submissions", icon: <FiFileText size={18} /> },
      { label: "Performance Reports", to: "/employee/reports", icon: <FiBarChart2 size={18} /> },
    ],
  },
  {
    title: "ACCOUNT",
    items: [
      { label: "My Profile", to: "/profile", icon: <FiUser size={18} /> },
      { label: "Settings", to: "/settings", icon: <FiSettings size={18} /> },
    ],
  },
];

export default function Sidebar({
  isCollapsed = true,
  isMobileOpen = false,
  onToggleSidebar,
  onCloseMobile,
}) {
  const { user, logout } = useAuth();
  const role = user?.role || "";
  const normRole = normalizeRole(role);
  const isSuperAdmin = normRole === "super_admin";
  const isHR = normRole === "hr_manager";
  const isEmployee = normRole === "employee";

  const displayRole = (() => {
    if (normRole === "super_admin") return "Super Admin";
    if (normRole === "admin") return "Admin";
    if (normRole === "hr_manager") return "HR Manager";
    if (normRole === "employee") return "Employee";
    return role;
  })();

  const visibleItems = isSuperAdmin
    ? superAdminMenuItems
    : menuItems.filter((item) => canAccessFeature(role, item.feature));

  const handleLinkClick = () => {
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const sidebarClasses = [
    "sidebar",
    isCollapsed ? "collapsed" : "",
    isMobileOpen ? "mobile-open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <aside className={sidebarClasses}>
      <div className="sidebar-top">
        {user && (
          <div className="sidebar-user-card" title={`${user.name} (${displayRole})`}>
            <div className="sidebar-user-avatar">
              {user.name?.charAt(0).toUpperCase() || "U"}
            </div>

            {!isCollapsed && (
              <div className="sidebar-user-details">
                <div className="sidebar-user-name">{user.name}</div>
                <div className="sidebar-user-role">{displayRole}</div>
              </div>
            )}
          </div>
        )}

        <nav className="sidebar-nav" aria-label="Main Navigation">
          {isHR ? (
            hrMenuSections.map((section, idx) => (
              <div key={section.title || idx} className="sidebar-section-group">
                {!isCollapsed && section.title && (
                  <div className="sidebar-section-title">{section.title}</div>
                )}
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={handleLinkClick}
                    title={isCollapsed ? item.label : undefined}
                    aria-label={item.label}
                    className={({ isActive }) =>
                      `sidebar-link ${isActive ? "active" : ""}`
                    }
                  >
                    <span className="sidebar-icon">{item.icon}</span>
                    {!isCollapsed && <span className="sidebar-label">{item.label}</span>}
                  </NavLink>
                ))}
              </div>
            ))
          ) : isEmployee ? (
            employeeMenuSections.map((section, idx) => (
              <div key={section.title || idx} className="sidebar-section-group">
                {!isCollapsed && section.title && (
                  <div className="sidebar-section-title">{section.title}</div>
                )}
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={handleLinkClick}
                    title={isCollapsed ? item.label : undefined}
                    aria-label={item.label}
                    className={({ isActive }) =>
                      `sidebar-link ${isActive ? "active" : ""}`
                    }
                  >
                    <span className="sidebar-icon">{item.icon}</span>
                    {!isCollapsed && <span className="sidebar-label">{item.label}</span>}
                  </NavLink>
                ))}
              </div>
            ))
          ) : visibleItems.length === 0 ? (
            <div className="sidebar-no-items">
              {!isCollapsed && "No menu items available."}
            </div>
          ) : (
            visibleItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={handleLinkClick}
                title={isCollapsed ? item.label : undefined}
                aria-label={item.label}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? "active" : ""}`
                }
              >
                <span className="sidebar-icon">{item.icon}</span>
                {!isCollapsed && <span className="sidebar-label">{item.label}</span>}
              </NavLink>
            ))
          )}
        </nav>
      </div>

      <div className="sidebar-footer">
        <button
          type="button"
          onClick={logout}
          className="sidebar-logout-btn"
          title="Logout"
          aria-label="Logout"
        >
          <span className="sidebar-icon">
            <FiLogOut size={18} />
          </span>
          {!isCollapsed && <span className="sidebar-label">Logout</span>}
        </button>
      </div>
    </aside>
  );
}