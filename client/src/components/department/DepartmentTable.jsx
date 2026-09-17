import React, { useState, useMemo } from "react";
import { FiEdit2, FiTrash2, FiSearch, FiLayers } from "react-icons/fi";

function StatusBadge({ status }) {
  const isAct = status === "Active";
  return (
    <span className={`badge ${isAct ? "badge-success" : "badge-danger"}`}>
      {status}
    </span>
  );
}

export default function DepartmentTable({
  departments = [],
  loading = false,
  onEdit,
  onDelete,
}) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("departmentName");
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const filteredDepts = useMemo(() => {
    let list = departments.filter((d) => {
      const q = search.toLowerCase();
      return (
        (d.departmentName && d.departmentName.toLowerCase().includes(q)) ||
        (d.departmentId && d.departmentId.toLowerCase().includes(q)) ||
        (d.location && d.location.toLowerCase().includes(q)) ||
        (d.description && d.description.toLowerCase().includes(q))
      );
    });

    list.sort((a, b) => {
      const valA = (a[sortField] || "").toString().toLowerCase();
      const valB = (b[sortField] || "").toString().toLowerCase();
      return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });

    return list;
  }, [departments, search, sortField, sortAsc]);

  if (loading) {
    return (
      <div className="table-loading" style={{ padding: "48px 24px", textAlign: "center" }}>
        <div className="emp-spinner" style={{ margin: "0 auto 12px" }} />
        Loading departments...
      </div>
    );
  }

  return (
    <div>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ position: "relative", minWidth: 200, maxWidth: 400, flex: "1 1 220px", display: "flex", alignItems: "center" }}>
          <FiSearch size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
          <input
            type="text"
            className="emp-form-input"
            style={{ paddingLeft: 36, height: 38, fontSize: "0.875rem", width: "100%" }}
            placeholder="Search departments by name, ID, location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
          {filteredDepts.length} department{filteredDepts.length !== 1 ? "s" : ""} found
        </span>
      </div>

      {filteredDepts.length === 0 ? (
        <div className="table-empty" style={{ padding: "48px 24px", textAlign: "center", color: "#94a3b8" }}>
          <FiLayers size={36} style={{ margin: "0 auto 8px", color: "#cbd5e1" }} />
          <p style={{ margin: 0, fontWeight: 600, color: "#64748b" }}>No departments found.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th
                  onClick={() => handleSort("departmentId")}
                  style={{ width: "15%", minWidth: "140px", cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  Department ID {sortField === "departmentId" ? (sortAsc ? "↑" : "↓") : "↕"}
                </th>
                <th
                  onClick={() => handleSort("departmentName")}
                  style={{ width: "20%", minWidth: "160px", cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  Name {sortField === "departmentName" ? (sortAsc ? "↑" : "↓") : "↕"}
                </th>
                <th style={{ width: "33%", minWidth: "200px" }}>Description</th>
                <th
                  onClick={() => handleSort("location")}
                  style={{ width: "14%", minWidth: "120px", cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  Location {sortField === "location" ? (sortAsc ? "↑" : "↓") : "↕"}
                </th>
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
              {filteredDepts.map((dept) => (
                <tr key={dept._id}>
                  <td style={{ fontWeight: 600, color: "#4f46e5", fontFamily: "monospace" }}>
                    {dept.departmentId}
                  </td>
                  <td style={{ fontWeight: 600, color: "#0f172a" }}>
                    {dept.departmentName}
                  </td>
                  <td style={{ color: "#64748b" }}>
                    {dept.description || "—"}
                  </td>
                  <td>{dept.location || "—"}</td>
                  <td>
                    <StatusBadge status={dept.status} />
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <button
                        type="button"
                        className="emp-action-icon-btn"
                        onClick={() => onEdit(dept)}
                        title="Edit Department"
                        aria-label={`Edit ${dept.departmentName}`}
                      >
                        <FiEdit2 size={15} />
                      </button>
                      <button
                        type="button"
                        className="emp-action-icon-btn delete"
                        onClick={() => onDelete(dept)}
                        title="Delete Department"
                        aria-label={`Delete ${dept.departmentName}`}
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