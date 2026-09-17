import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../../context/ToastContext";
import RoleTable from "../../../components/role/RoleTable";
import ConfirmModal from "../../../components/Modal/ConfirmModal";
import { getRoles, deleteRole } from "../../../services/roleService";
import { FiArrowLeft, FiPlus, FiShield } from "react-icons/fi";
import "../department-role.css";

export default function RoleList() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadRoles = async () => {
    try {
      setLoading(true);
      const res = await getRoles();
      setRoles(res.data || res || []);
    } catch (err) {
      showToast('error', err.message || "Failed to load roles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoles();
  }, []);

  const handleEdit = (role) => {
    navigate(`/employee/roles/edit/${role._id}`);
  };

  const handleDeleteClick = (role) => {
    setDeleteTarget(role);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteRole(deleteTarget._id);
      showToast('success', `Role "${deleteTarget.roleName}" deleted successfully.`);
      setDeleteTarget(null);
      loadRoles();
    } catch (err) {
      showToast('error', err.message || "Failed to delete role");
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
          <h2>Roles</h2>
          <p>Manage system roles, access tiers, and employee permissions.</p>
        </div>

        <button
          type="button"
          className="emp-btn-primary"
          onClick={() => navigate("/employee/roles/add")}
          aria-label="Add Role"
        >
          <FiPlus size={16} /> Add Role
        </button>
      </div>

      <RoleTable
        roles={roles}
        loading={loading}
        onEdit={handleEdit}
        onDelete={handleDeleteClick}
      />

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Role?"
        message={`Are you sure you want to delete the role "${deleteTarget?.roleName}"? Users with this role may lose associated access permissions.`}
        confirmText="Delete Role"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}