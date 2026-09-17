import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import EmployeeForm from "../../components/employee/EmployeeForm.jsx";
import { createEmployee, getAllEmployees } from "../../services/employeeService.js";
import { getAllDepartments } from "../../services/profileService.js";
import { createOnboarding } from "../../services/onboardingService.js";
import "../../components/employee/emp.shared.css";
import "../../components/employee/EmployeeForm.css";
import { FiArrowLeft, FiCheckSquare } from "react-icons/fi";

async function fetchUsers() {
  const token = localStorage.getItem("token");
  const res = await fetch("/api/users", {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data?.users || data || [];
}

export default function AddEmployee() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const role = user?.role || "";

  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [users, setUsers] = useState([]);
  const [autoOnboard, setAutoOnboard] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    Promise.all([
      getAllDepartments(),
      getAllEmployees({ page: 1, limit: 200 }),
      fetchUsers(),
    ])
      .then(([deptData, empData, userData]) => {
        setDepartments(deptData?.departments || deptData?.data || (Array.isArray(deptData) ? deptData : []));
        const empList = empData?.employees || empData?.data || (Array.isArray(empData) ? empData : []);
        setEmployees(empList);
        const rawUsers = Array.isArray(userData) ? userData : userData?.users || [];
        // Only include users who are not yet registered as an employee
        const existingEmpUserIds = new Set(
          empList.map((e) => String(e.user_id?._id || e.user_id || ""))
        );
        const unlinkedUsers = rawUsers.filter(
          (u) => !existingEmpUserIds.has(String(u._id || u.id || ""))
        );
        setUsers(unlinkedUsers);
      })
      .catch((err) => setError(err.message || "Failed to load form data"));
  }, []);

  const handleSubmit = async (formData) => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await createEmployee(formData);
      const newEmp = res?.employee || res?.data;

      if (autoOnboard && newEmp?._id) {
        try {
          const obRes = await createOnboarding({ employee_id: newEmp._id });
          showToast("success", "Employee created & onboarding checklist started!");
          const targetId = obRes?.onboarding?._id || "";
          setTimeout(() => navigate(targetId ? `/onboarding/${targetId}` : "/onboarding"), 1000);
          return;
        } catch (obErr) {
          console.warn("Auto-onboarding warning:", obErr.message);
        }
      }

      const msg = "Employee created successfully!";
      setSuccess(msg);
      showToast('success', msg);
      setTimeout(() => navigate("/employee"), 1400);
    } catch (err) {
      const errMsg = err.message || "Failed to create employee";
      setError(errMsg);
      showToast('error', errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="emp-page">
      <div className="emp-page-header">
        <div className="emp-page-header-text">
          <h1>Add New Employee</h1>
          <p>Fill in the details to onboard a new employee.</p>
        </div>
        <Link
          to="/employee"
          className="emp-btn-secondary"
          id="add-emp-back-btn"
          style={{ cursor: "pointer" }}
        >
          <FiArrowLeft size={16} /> Back to Directory
        </Link>
      </div>



      <div
        style={{
          background: "#eef2ff",
          border: "1px solid #c7d2fe",
          padding: "12px 18px",
          borderRadius: 10,
          margin: "8px 0 16px 0",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <input
          type="checkbox"
          id="auto-onboard-check"
          checked={autoOnboard}
          onChange={(e) => setAutoOnboard(e.target.checked)}
          style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#4f46e5" }}
        />
        <label
          htmlFor="auto-onboard-check"
          style={{ fontSize: 13, fontWeight: 600, color: "#3730a3", cursor: "pointer" }}
        >
          Automatically initialize standard Onboarding checklist (HR, IT, Admin, Finance) upon creation
        </label>
      </div>

      <div className="emp-form-page">
        <EmployeeForm
          title="Employee Information"
          departments={departments}
          employees={employees}
          users={users}
          loading={loading}
          onSubmit={handleSubmit}
          onCancel={() => navigate("/employee")}
        />
      </div>
    </div>
  );
}