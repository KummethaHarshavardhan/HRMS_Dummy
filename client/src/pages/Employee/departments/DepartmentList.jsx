import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../../context/ToastContext.jsx";
import DepartmentTable from "../../../components/department/DepartmentTable";
import ConfirmModal from "../../../components/Modal/ConfirmModal";
import { getDepartments, deleteDepartment } from "../../../services/departmentService";
import { FiArrowLeft, FiPlus } from "react-icons/fi";
import "../department-role.css";

export default function DepartmentList() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadDepartments = async () => {
    try {
      setLoading(true);
      const res = await getDepartments();
      setDepartments(res.data || res || []);
    } catch (err) {
      showToast('error', err.message || "Failed to load departments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  const handleEdit = (department) => {
    navigate(`/employee/departments/edit/${department._id}`);
  };

  const handleDeleteClick = (department) => {
    setDeleteTarget(department);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDepartment(deleteTarget._id);
      showToast('success', `Department "${deleteTarget.departmentName}" deleted successfully.`);
      setDeleteTarget(null);
      loadDepartments();
    } catch (err) {
      showToast('error', err.message || "Failed to delete department");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <button
            type="button"
            className="emp-btn-secondary"
            style={{ marginBottom: "12px" }}
            onClick={() => navigate("/employee")}
            aria-label="Back to Directory"
          >
            <FiArrowLeft size={15} /> Back to Directory
          </button>
          <h2>Departments</h2>
          <p>Manage all company departments, organizational units, and locations.</p>
        </div>

        <button
          type="button"
          className="emp-btn-primary"
          onClick={() => navigate("/employee/departments/add")}
          aria-label="Add Department"
        >
          <FiPlus size={16} /> Add Department
        </button>
      </div>

      <div className="table-card">
        <DepartmentTable
          departments={departments}
          loading={loading}
          onEdit={handleEdit}
          onDelete={handleDeleteClick}
        />
      </div>

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Department?"
        message={`Are you sure you want to delete "${deleteTarget?.departmentName}"? Associated employee assignments may be affected.`}
        confirmText="Delete Department"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
