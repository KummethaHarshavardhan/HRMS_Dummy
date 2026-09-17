import React, { useState, useMemo } from "react";
import { FiEdit2, FiTrash2, FiSearch, FiShield } from "react-icons/fi";

export default function RoleTable({
  roles = [],
  loading = false,
  onEdit,
  onDelete,
}) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("roleName");
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const filteredRoles = useMemo(() => {
    let list = roles.filter((r) => {
      const q = search.toLowerCase();
      return (
        (r.roleName && r.roleName.toLowerCase().includes(q)) ||
        (r.roleId && r.roleId.toLowerCase().includes(q)) ||
        (r.description && r.description.toLowerCase().includes(q))
      );
    });

    list.sort((a, b) => {
      const valA = (a[sortField] || "").toString().toLowerCase();
      const valB = (b[sortField] || "").toString().toLowerCase();
      return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });

    return list;
  }, [roles, search, sortField, sortAsc]);

  if (loading) {
    return (
      <div className="table-card">
        <div className="loading" style={{ padding: "48px 24px", textAlign: "center" }}>
          <div className="emp-spinner" style={{ margin: "0 auto 12px" }} />
          Loading roles...
        </div>
      </div>
    );
  }

  return (
    <div className="table-card">
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ position: "relative", minWidth: 200, maxWidth: 400, flex: "1 1 220px", display: "flex", alignItems: "center" }}>
          <FiSearch size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
          <input
            type="text"
            className="emp-form-input"
            style={{ paddingLeft: 36, height: 38, fontSize: "0.875rem", width: "100%" }}
            placeholder="Search roles by name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
          {filteredRoles.length} role{filteredRoles.length !== 1 ? "s" : ""} found
        </span>
      </div>

      {filteredRoles.length === 0 ? (
        <div className="empty-state" style={{ padding: "48px 24px", textAlign: "center", color: "#94a3b8" }}>
          <FiShield size={36} style={{ margin: "0 auto 8px", color: "#cbd5e1" }} />
          <p style={{ margin: 0, fontWeight: 600, color: "#64748b" }}>No roles found.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th
                  onClick={() => handleSort("roleId")}
                  style={{ width: "14%", minWidth: "120px", cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  Role ID {sortField === "roleId" ? (sortAsc ? "↑" : "↓") : "↕"}
                </th>
                <th
                  onClick={() => handleSort("roleName")}
                  style={{ width: "18%", minWidth: "150px", cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  Role Name {sortField === "roleName" ? (sortAsc ? "↑" : "↓") : "↕"}
                </th>
                <th style={{ width: "26%", minWidth: "180px" }}>Description</th>
                <th style={{ width: "24%", minWidth: "180px" }}>Permissions</th>
                <th
                  onClick={() => handleSort("status")}
                  style={{ width: "10%", minWidth: "100px", cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  Status {sortField === "status" ? (sortAsc ? "↑" : "↓") : "↕"}
                </th>
                <th style={{ width: "8%", minWidth: "90px", textAlign: "center", whiteSpace: "nowrap" }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredRoles.map((role) => (
                <tr key={role._id}>
                  <td style={{ fontWeight: 600, color: "#4f46e5", fontFamily: "monospace" }}>
                    {role.roleId}
                  </td>
                  <td style={{ fontWeight: 600, color: "#0f172a" }}>
                    {role.roleName}
                  </td>
                  <td style={{ color: "#64748b" }}>
                    {role.description || "—"}
                  </td>
                  <td style={{ fontSize: "0.85rem", color: "#475569" }}>
                    {Array.isArray(role.permissions)
                      ? role.permissions.join(", ")
                      : role.permissions || "—"}
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        role.status === "Active" ? "badge-success" : "badge-danger"
                      }`}
                    >
                      {role.status}
                    </span>
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <button
                        type="button"
                        className="emp-action-icon-btn"
                        onClick={() => onEdit(role)}
                        title="Edit Role"
                        aria-label={`Edit ${role.roleName}`}
                      >
                        <FiEdit2 size={15} />
                      </button>
                      <button
                        type="button"
                        className="emp-action-icon-btn delete"
                        onClick={() => onDelete(role)}
                        title="Delete Role"
                        aria-label={`Delete ${role.roleName}`}
                      >
                        <FiTrash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}