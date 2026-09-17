import { useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import { useAuth } from "./context/AuthContext";
import Header from "./components/Header/Header";
import Sidebar from "./components/Sidebar/Sidebar";
import ProtectedRoute from "./utils/ProtectedRoute";

import Login from "./pages/Login/Login";
import ForgotPassword from "./pages/ForgotPassword/ForgotPassword";
import VerifyOTP from "./pages/VerifyOTP/VerifyOTP";
import ResetPassword from "./pages/ResetPassword/ResetPassword";
import ChangePassword from "./pages/ChangePassword/ChangePassword";

import SuperAdminDashboard from "./pages/SuperAdmin/SuperAdminDashboard";
import Organizations from "./pages/SuperAdmin/Organizations";
import HRManagement from "./pages/SuperAdmin/HRManagement";
import OrganizationUsage from "./pages/SuperAdmin/OrganizationUsage";
import SuperAdminPayroll from "./pages/SuperAdmin/SuperAdminPayroll";
import SuperAdminDocumentVerification from "./pages/SuperAdmin/SuperAdminDocumentVerification";
import { normalizeRole } from "./utils/permission";

import Dashboard from "./pages/Dashboard/Dashboard";
import Profile from "./pages/Profile/Profile";

import AttendanceDashboard from "./pages/Attendance/AttendanceDashboard";

import PayrollRoutes from "./routes/PayrollRoutes";
import ReportsRoutes from "./routes/ReportsRoutes";
import Settings from "./pages/Settings/Settings";
import Users from "./pages/Users/Users";

import EmployeeList from "./pages/Employee/EmployeeList";
import AddEmployee from "./pages/Employee/AddEmployee";
import EditEmployee from "./pages/Employee/EditEmployee";
import EmployeeDetails from "./pages/Employee/EmployeeDetails";
import EmployeeProfile from "./pages/Employee/EmployeeProfile";

import DepartmentList from "./pages/Employee/departments/DepartmentList";
import AddDepartment from "./pages/Employee/departments/AddDepartment";
import EditDepartment from "./pages/Employee/departments/EditDepartment";

import RoleList from "./pages/Employee/roles/RoleList";
import AddRole from "./pages/Employee/roles/AddRole";
import EditRole from "./pages/Employee/roles/EditRole";


import LeaveDashboard from "./pages/Leave/LeaveDashboard";
import HolidayCalendar from "./pages/Holidays/HolidayCalendar";
import HolidayManagement from "./pages/Holidays/HolidayManagement";
import OnboardingList from "./pages/Onboarding/OnboardingList";
import OnboardingDetails from "./pages/Onboarding/OnboardingDetails";
import OffboardingList from "./pages/Offboarding/OffboardingList";
import OffboardingDetails from "./pages/Offboarding/OffboardingDetails";
import AssetInventory from "./pages/Assets/AssetInventory";
import AssetAssignment from "./pages/Assets/AssetAssignment";
import DocumentVerification from "./pages/Documents/DocumentVerification";
import ShiftManagement from "./pages/Shifts/ShiftManagement";
import WFHRequests from "./pages/WFH/WFHRequests";

// Task Monitoring System Pages
import CandidateListPage from "./pages/TaskMonitoring/Candidates/CandidateListPage";
import CandidateDetailsPage from "./pages/TaskMonitoring/Candidates/CandidateDetailsPage";
import TaskListPage from "./pages/TaskMonitoring/Tasks/TaskListPage";
import CreateTaskPage from "./pages/TaskMonitoring/Tasks/CreateTaskPage";
import TaskDetailsPage from "./pages/TaskMonitoring/Tasks/TaskDetailsPage";
import ProgressDashboardPage from "./pages/TaskMonitoring/Progress/ProgressDashboardPage";
import SubmissionListPage from "./pages/TaskMonitoring/Submissions/SubmissionListPage";
import ReviewQueuePage from "./pages/TaskMonitoring/Reviews/ReviewQueuePage";
import ReportsOverviewPage from "./pages/TaskMonitoring/Reports/ReportsOverviewPage";

// Employee Task Monitoring System Pages
import EmployeeTasksPage from "./pages/TaskMonitoring/Employee/EmployeeTasksPage";
import EmployeeTaskDetailsPage from "./pages/TaskMonitoring/Employee/EmployeeTaskDetailsPage";
import EmployeeProgressPage from "./pages/TaskMonitoring/Employee/EmployeeProgressPage";
import EmployeeSubmissionsPage from "./pages/TaskMonitoring/Employee/EmployeeSubmissionsPage";
import EmployeeReportsPage from "./pages/TaskMonitoring/Employee/EmployeeReportsPage";

function ProtectedLayout() {
  const { isAuthenticated } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const handleToggleSidebar = () => {
    if (window.innerWidth <= 1024) {
      setIsMobileOpen((prev) => !prev);
    } else {
      setIsSidebarCollapsed((prev) => !prev);
    }
  };

  return (
    <div className={`app-layout ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      {isMobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <Sidebar
        isCollapsed={isSidebarCollapsed}
        isMobileOpen={isMobileOpen}
        onToggleSidebar={handleToggleSidebar}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      <div className="app-main-wrapper">
        <Header onToggleSidebar={handleToggleSidebar} />
        <main className="app-main-content">
          <Outlet />
        </main>
      </div>

    </div>
  );
}

function AppRoutes() {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  const isSuperAdmin = normalizeRole(user?.role) === "super_admin";

  const publicPaths = [
    "/login",
    "/forgot-password",
    "/verify-otp",
    "/reset-password",
  ];

  if (!isAuthenticated && (publicPaths.includes(location.pathname) || location.pathname === "/register")) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Navigate to="/login" replace />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/verify-otp" element={<VerifyOTP />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate to={isSuperAdmin ? "/super-admin/dashboard" : "/dashboard"} replace />
          ) : (
            <Login />
          )
        }
      />

      <Route
        path="/register"
        element={<Navigate to="/login" replace />}
      />

      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/verify-otp" element={<VerifyOTP />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route
        element={
          <ProtectedRoute>
            <ProtectedLayout />
          </ProtectedRoute>
        }
      >
        <Route
          path="/"
          element={
            <Navigate to={isSuperAdmin ? "/super-admin/dashboard" : "/dashboard"} replace />
          }
        />

        {/* Super Admin Specific Routes */}
        <Route
          path="/super-admin/dashboard"
          element={
            <ProtectedRoute allowedRoles={["super_admin"]}>
              <SuperAdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/organizations"
          element={
            <ProtectedRoute allowedRoles={["super_admin"]}>
              <Organizations />
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/hr-management"
          element={
            <ProtectedRoute allowedRoles={["super_admin"]}>
              <HRManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/usage-limits"
          element={
            <ProtectedRoute allowedRoles={["super_admin"]}>
              <OrganizationUsage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/payroll"
          element={
            <ProtectedRoute allowedRoles={["super_admin"]}>
              <SuperAdminPayroll />
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/document-verification"
          element={
            <ProtectedRoute allowedRoles={["super_admin"]}>
              <SuperAdminDocumentVerification />
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/wfh-requests"
          element={
            <ProtectedRoute allowedRoles={["super_admin"]}>
              <WFHRequests />
            </ProtectedRoute>
          }
        />

        {/* Existing Routes */}
        <Route
          path="/dashboard"
          element={
            isSuperAdmin ? (
              <Navigate to="/super-admin/dashboard" replace />
            ) : (
              <ProtectedRoute allowedRoles={["Admin", "HR Manager", "Employee"]}>
                <Dashboard />
              </ProtectedRoute>
            )
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute allowedRoles={["super_admin", "Admin", "HR Manager", "Employee"]}>
              <Profile />
            </ProtectedRoute>
          }
        />

        <Route
          path="/directory"
          element={
            <ProtectedRoute allowedRoles={["Admin", "HR Manager"]}>
              <EmployeeList />
            </ProtectedRoute>
          }
        />

        <Route
          path="/employee"
          element={
            <ProtectedRoute allowedRoles={["Admin", "HR Manager"]}>
              <EmployeeList />
            </ProtectedRoute>
          }
        />

        <Route
          path="/employee/add"
          element={
            <ProtectedRoute allowedRoles={["Admin", "HR Manager"]}>
              <AddEmployee />
            </ProtectedRoute>
          }
        />

        <Route
          path="/employee/profile"
          element={<Navigate to="/profile" replace />}
        />

        <Route
          path="/employee/:id"
          element={
            <ProtectedRoute allowedRoles={["Admin", "HR Manager"]}>
              <EmployeeDetails />
            </ProtectedRoute>
          }
        />

        <Route
          path="/employee/:id/edit"
          element={
            <ProtectedRoute allowedRoles={["Admin", "HR Manager"]}>
              <EditEmployee />
            </ProtectedRoute>
          }
        />

        <Route
          path="/employee/departments"
          element={
            <ProtectedRoute allowedRoles={["Admin"]}>
              <DepartmentList />
            </ProtectedRoute>
          }
        />

        <Route
          path="/employee/departments/add"
          element={
            <ProtectedRoute allowedRoles={["Admin"]}>
              <AddDepartment />
            </ProtectedRoute>
          }
        />

        <Route
          path="/employee/departments/edit/:id"
          element={
            <ProtectedRoute allowedRoles={["Admin"]}>
              <EditDepartment />
            </ProtectedRoute>
          }
        />

        <Route
          path="/employee/roles"
          element={
            <ProtectedRoute allowedRoles={["Admin"]}>
              <RoleList />
            </ProtectedRoute>
          }
        />

        <Route
          path="/employee/roles/add"
          element={
            <ProtectedRoute allowedRoles={["Admin"]}>
              <AddRole />
            </ProtectedRoute>
          }
        />

        <Route
          path="/employee/roles/edit/:id"
          element={
            <ProtectedRoute allowedRoles={["Admin"]}>
              <EditRole />
            </ProtectedRoute>
          }
        />

        <Route
          path="/attendance-dashboard"
          element={
            <ProtectedRoute allowedRoles={["Admin", "HR Manager", "Employee"]}>
              <AttendanceDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/leave"
          element={
            <ProtectedRoute allowedRoles={["super_admin", "Admin", "HR Manager", "Employee"]}>
              <LeaveDashboard />
            </ProtectedRoute>
          }
        />

        {/* Holiday Calendar Routes */}
        <Route
          path="/holidays"
          element={
            <ProtectedRoute allowedRoles={["super_admin", "Admin", "HR Manager", "Employee"]}>
              <HolidayCalendar />
            </ProtectedRoute>
          }
        />
        <Route
          path="/holidays/manage"
          element={
            <ProtectedRoute allowedRoles={["super_admin", "Admin", "HR Manager"]}>
              <HolidayManagement />
            </ProtectedRoute>
          }
        />

        {/* Onboarding & Offboarding Routes */}
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute allowedRoles={["Admin", "HR Manager"]}>
              <OnboardingList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/onboarding/:id"
          element={
            <ProtectedRoute allowedRoles={["Admin", "HR Manager", "Employee"]}>
              <OnboardingDetails />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employee/onboarding"
          element={
            <ProtectedRoute allowedRoles={["Employee", "Admin", "HR Manager"]}>
              <OnboardingDetails />
            </ProtectedRoute>
          }
        />

        <Route
          path="/offboarding"
          element={
            <ProtectedRoute allowedRoles={["Admin", "HR Manager"]}>
              <OffboardingList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/offboarding/:id"
          element={
            <ProtectedRoute allowedRoles={["Admin", "HR Manager", "Employee"]}>
              <OffboardingDetails />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employee/offboarding"
          element={
            <ProtectedRoute allowedRoles={["Employee", "Admin", "HR Manager"]}>
              <OffboardingDetails />
            </ProtectedRoute>
          }
        />

        {/* Asset Management Routes */}
        <Route
          path="/assets"
          element={
            <ProtectedRoute allowedRoles={["Admin", "HR Manager"]}>
              <AssetInventory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/assets/assignments"
          element={
            <ProtectedRoute allowedRoles={["Admin", "HR Manager"]}>
              <AssetAssignment />
            </ProtectedRoute>
          }
        />

        {/* Shift & Roster Management Route */}
        <Route
          path="/shifts"
          element={
            <ProtectedRoute allowedRoles={["Admin", "HR Manager"]}>
              <ShiftManagement />
            </ProtectedRoute>
          }
        />

        {/* Document Verification Route */}
        <Route
          path="/hr/document-verification"
          element={
            <ProtectedRoute allowedRoles={["Admin", "HR Manager"]}>
              <DocumentVerification />
            </ProtectedRoute>
          }
        />

        {/* Work From Home Requests (HR/Admin view-only) */}
        <Route
          path="/wfh-requests"
          element={
            <ProtectedRoute allowedRoles={["Admin", "HR Manager", "HR", "Employee", "employee"]}>
              <WFHRequests />
            </ProtectedRoute>
          }
        />

        <Route
          path="/payroll/*"
          element={
            isSuperAdmin ? (
              <Navigate to="/super-admin/payroll" replace />
            ) : (
              <ProtectedRoute allowedRoles={["Admin", "HR Manager", "Employee"]}>
                <PayrollRoutes />
              </ProtectedRoute>
            )
          }
        />

        <Route
          path="/reports/*"
          element={
            <ProtectedRoute allowedRoles={["Admin", "HR Manager"]}>
              <ReportsRoutes />
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings"
          element={
            <ProtectedRoute allowedRoles={["Admin", "HR Manager", "Employee"]}>
              <Settings />
            </ProtectedRoute>
          }
        />

        <Route
          path="/users"
          element={
            <ProtectedRoute allowedRoles={["Admin"]}>
              <Users />
            </ProtectedRoute>
          }
        />

        <Route
          path="/change-password"
          element={
            <ProtectedRoute allowedRoles={["Admin", "HR Manager", "Employee"]}>
              <ChangePassword />
            </ProtectedRoute>
          }
        />

        {/* HR Task Monitoring System Routes */}
        <Route
          path="/hr/candidates"
          element={
            <ProtectedRoute allowedRoles={["Admin", "HR Manager", "HR"]}>
              <CandidateListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hr/candidates/:id"
          element={
            <ProtectedRoute allowedRoles={["Admin", "HR Manager", "HR"]}>
              <CandidateDetailsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/candidates"
          element={<Navigate to="/hr/candidates" replace />}
        />

        <Route
          path="/hr/tasks"
          element={
            <ProtectedRoute allowedRoles={["Admin", "HR Manager", "HR"]}>
              <TaskListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hr/tasks/create"
          element={
            <ProtectedRoute allowedRoles={["Admin", "HR Manager", "HR"]}>
              <CreateTaskPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hr/tasks/:id"
          element={
            <ProtectedRoute allowedRoles={["Admin", "HR Manager", "HR"]}>
              <TaskDetailsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hr/task-allocation"
          element={<Navigate to="/hr/tasks" replace />}
        />

        <Route
          path="/hr/progress"
          element={
            <ProtectedRoute allowedRoles={["Admin", "HR Manager", "HR"]}>
              <ProgressDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hr/progress-tracking"
          element={<Navigate to="/hr/progress" replace />}
        />

        <Route
          path="/hr/submissions"
          element={
            <ProtectedRoute allowedRoles={["Admin", "HR Manager", "HR"]}>
              <SubmissionListPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/hr/reviews"
          element={
            <ProtectedRoute allowedRoles={["Admin", "HR Manager", "HR"]}>
              <ReviewQueuePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hr/review-queue"
          element={<Navigate to="/hr/reviews" replace />}
        />

        <Route
          path="/hr/reports"
          element={
            <ProtectedRoute allowedRoles={["Admin", "HR Manager", "HR"]}>
              <ReportsOverviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hr/reports-analytics"
          element={<Navigate to="/hr/reports" replace />}
        />
        <Route
          path="/hr/dashboard"
          element={<Navigate to="/dashboard" replace />}
        />

        {/* Employee Task Monitoring Routes */}
        <Route
          path="/employee/tasks"
          element={
            <ProtectedRoute allowedRoles={["Employee", "Admin", "HR Manager", "HR"]}>
              <EmployeeTasksPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employee/tasks/:id"
          element={
            <ProtectedRoute allowedRoles={["Employee", "Admin", "HR Manager", "HR"]}>
              <EmployeeTaskDetailsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employee/progress"
          element={
            <ProtectedRoute allowedRoles={["Employee", "Admin", "HR Manager", "HR"]}>
              <EmployeeProgressPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employee/submissions"
          element={
            <ProtectedRoute allowedRoles={["Employee", "Admin", "HR Manager", "HR"]}>
              <EmployeeSubmissionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employee/reports"
          element={
            <ProtectedRoute allowedRoles={["Employee", "Admin", "HR Manager", "HR"]}>
              <EmployeeReportsPage />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route
        path="*"
        element={
          <Navigate
            to={
              isAuthenticated
                ? isSuperAdmin
                  ? "/super-admin/dashboard"
                  : "/dashboard"
                : "/login"
            }
            replace
          />
        }
      />
    </Routes>
  );
}


function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;