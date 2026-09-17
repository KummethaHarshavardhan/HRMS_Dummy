import React, { useState, useEffect, useMemo } from "react";
import {
  FiClock,
  FiUsers,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiSearch,
  FiFilter,
  FiCheck,
  FiX,
  FiAlertCircle,
  FiCheckCircle,
  FiMoon,
  FiSun,
  FiLayers,
  FiUserPlus,
  FiUserMinus,
} from "react-icons/fi";
import {
  getAllShifts,
  createShift,
  updateShift,
  deleteShift,
  getAllShiftGroups,
  createShiftGroup,
  updateShiftGroup,
  assignShiftToGroup,
  addEmployeesToGroup,
  removeEmployeeFromGroup,
  deleteShiftGroup,
} from "../../services/shiftService";
import { getAllEmployees } from "../../services/employeeService";
import { getDepartments } from "../../services/departmentService";
import { useToast } from "../../context/ToastContext";
import "./ShiftManagement.css";

// Standard preset colors for shift badges
const PRESET_COLORS = [
  { name: "Indigo", hex: "#4f46e5" },
  { name: "Emerald", hex: "#059669" },
  { name: "Amber", hex: "#d97706" },
  { name: "Rose", hex: "#e11d48" },
  { name: "Purple", hex: "#9333ea" },
  { name: "Cyan", hex: "#0891b2" },
  { name: "Slate", hex: "#475569" },
];

// Helper to compute shift duration and check overnight
export const getShiftTimingInfo = (startTime, endTime) => {
  if (!startTime || !endTime) return { duration: "", isOvernight: false };
  const [sH, sM] = startTime.split(":").map(Number);
  const [eH, eM] = endTime.split(":").map(Number);

  if (isNaN(sH) || isNaN(sM) || isNaN(eH) || isNaN(eM)) {
    return { duration: "", isOvernight: false };
  }

  let startMinutes = sH * 60 + sM;
  let endMinutes = eH * 60 + eM;

  let isOvernight = false;
  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60;
    isOvernight = true;
  }

  const diffMinutes = endMinutes - startMinutes;
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;

  const durationStr = minutes > 0 ? `${hours}h ${minutes}m` : `${hours} hrs`;

  return { duration: durationStr, isOvernight };
};

export default function ShiftManagement() {
  const { showToast } = useToast();

  // Data states
  const [shifts, setShifts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Shift Modal State
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [shiftForm, setShiftForm] = useState({
    name: "",
    start_time: "09:00",
    end_time: "18:00",
    color: "#4f46e5",
    is_active: true,
  });
  const [shiftSubmitting, setShiftSubmitting] = useState(false);
  const [shiftError, setShiftError] = useState("");

  // Group Modal State
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [groupForm, setGroupForm] = useState({
    name: "",
    shift_id: "",
    employee_ids: [],
  });
  const [groupSubmitting, setGroupSubmitting] = useState(false);
  const [groupError, setGroupError] = useState("");

  // Employee picker search & filter inside modal
  const [empSearch, setEmpSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");

  // Members Drawer / Modal State
  const [viewingGroup, setViewingGroup] = useState(null);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [addingMembersMode, setAddingMembersMode] = useState(false);
  const [selectedNewMemberIds, setSelectedNewMemberIds] = useState([]);
  const [membersSubmitting, setMembersSubmitting] = useState(false);

  // Quick reassign loading state per group row
  const [reassigningGroupId, setReassigningGroupId] = useState(null);

  // Load all initial data
  const fetchData = async () => {
    try {
      setLoading(true);
      const [shiftsRes, groupsRes, empsRes, deptsRes] = await Promise.all([
        getAllShifts(),
        getAllShiftGroups(),
        getAllEmployees({ limit: 1000, status: "Active" }),
        getDepartments().catch(() => ({ data: [] })),
      ]);

      setShifts(shiftsRes?.data || []);
      setGroups(groupsRes?.data || []);
      setEmployees(empsRes?.employees || empsRes?.data || []);
      setDepartments(deptsRes?.departments || deptsRes?.data || []);
    } catch (err) {
      console.error("Failed to load shift management data:", err);
      showToast(err?.message || "Failed to load shift data.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalShifts = shifts.length;
    const activeShifts = shifts.filter((s) => s.is_active).length;
    const totalGroups = groups.length;
    const assignedEmpIds = new Set();
    groups.forEach((g) => {
      (g.employee_ids || []).forEach((e) => {
        const id = e._id || e;
        if (id) assignedEmpIds.add(String(id));
      });
    });
    return {
      totalShifts,
      activeShifts,
      totalGroups,
      assignedEmployees: assignedEmpIds.size,
    };
  }, [shifts, groups]);

  // =========================================================================
  // SHIFT MODAL HANDLERS
  // =========================================================================

  const handleOpenAddShift = () => {
    setEditingShift(null);
    setShiftForm({
      name: "",
      start_time: "09:00",
      end_time: "18:00",
      color: "#4f46e5",
      is_active: true,
    });
    setShiftError("");
    setIsShiftModalOpen(true);
  };

  const handleOpenEditShift = (shift) => {
    setEditingShift(shift);
    setShiftForm({
      name: shift.name,
      start_time: shift.start_time,
      end_time: shift.end_time,
      color: shift.color || "#4f46e5",
      is_active: shift.is_active !== undefined ? shift.is_active : true,
    });
    setShiftError("");
    setIsShiftModalOpen(true);
  };

  const handleSaveShift = async (e) => {
    e.preventDefault();
    if (!shiftForm.name.trim()) {
      setShiftError("Shift name is required.");
      return;
    }
    if (shiftForm.start_time === shiftForm.end_time) {
      setShiftError("Start time and end time cannot be identical.");
      return;
    }

    try {
      setShiftSubmitting(true);
      setShiftError("");

      if (editingShift) {
        await updateShift(editingShift._id, shiftForm);
        showToast(`Shift "${shiftForm.name}" updated successfully!`, "success");
      } else {
        await createShift(shiftForm);
        showToast(`Shift "${shiftForm.name}" created successfully!`, "success");
      }

      setIsShiftModalOpen(false);
      await fetchData();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Failed to save shift.";
      setShiftError(msg);
    } finally {
      setShiftSubmitting(false);
    }
  };

  const handleDeleteShift = async (shift) => {
    if (!window.confirm(`Are you sure you want to delete shift "${shift.name}"?`)) {
      return;
    }

    try {
      await deleteShift(shift._id);
      showToast(`Shift "${shift.name}" deleted successfully.`, "success");
      await fetchData();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Failed to delete shift.";
      showToast(msg, "error");
    }
  };

  // =========================================================================
  // SHIFT GROUP MODAL HANDLERS
  // =========================================================================

  const handleOpenCreateGroup = () => {
    const activeList = shifts.filter((s) => s.is_active);
    if (activeList.length === 0) {
      showToast("No active shifts found. Please define a work shift first before creating a group.", "warning");
      handleOpenAddShift();
      return;
    }
    setEditingGroup(null);
    setGroupForm({
      name: "",
      shift_id: activeList[0]?._id || "",
      employee_ids: [],
    });
    setEmpSearch("");
    setDeptFilter("all");
    setGroupError("");
    setIsGroupModalOpen(true);
  };

  const handleOpenEditGroup = (group) => {
    setEditingGroup(group);
    const existingIds = (group.employee_ids || []).map((e) => e._id || e);
    setGroupForm({
      name: group.name,
      shift_id: group.shift_id?._id || group.shift_id || "",
      employee_ids: existingIds,
    });
    setEmpSearch("");
    setDeptFilter("all");
    setGroupError("");
    setIsGroupModalOpen(true);
  };

  const handleSaveGroup = async (e) => {
    e.preventDefault();
    if (!groupForm.name.trim()) {
      setGroupError("Group name is required.");
      return;
    }
    if (!groupForm.shift_id) {
      setGroupError("Please select an active shift for this group.");
      return;
    }

    try {
      setGroupSubmitting(true);
      setGroupError("");

      if (editingGroup) {
        await updateShiftGroup(editingGroup._id, groupForm);
        showToast(`Shift group "${groupForm.name}" updated successfully!`, "success");
      } else {
        await createShiftGroup(groupForm);
        showToast(`Shift group "${groupForm.name}" created with ${groupForm.employee_ids.length} employees!`, "success");
      }

      setIsGroupModalOpen(false);
      await fetchData();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Failed to save shift group.";
      setGroupError(msg);
    } finally {
      setGroupSubmitting(false);
    }
  };

  const handleDeleteGroup = async (group) => {
    if (!window.confirm(`Are you sure you want to delete shift group "${group.name}"? Members will be removed from this shift.`)) {
      return;
    }

    try {
      await deleteShiftGroup(group._id);
      showToast(`Shift group "${group.name}" deleted successfully.`, "success");
      await fetchData();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Failed to delete shift group.";
      showToast(msg, "error");
    }
  };

  // Quick inline reassign shift on a group row
  const handleQuickReassignShift = async (group, newShiftId) => {
    if (!newShiftId || newShiftId === (group.shift_id?._id || group.shift_id)) return;
    try {
      setReassigningGroupId(group._id);
      const res = await assignShiftToGroup(group._id, newShiftId);
      const memberCount = group.employee_ids?.length || 0;
      const targetShift = shifts.find((s) => s._id === newShiftId);
      showToast(
        `Reassigned group "${group.name}" to ${targetShift?.name || "new shift"}! ${memberCount} employee(s) notified.`,
        "success"
      );
      await fetchData();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Failed to reassign shift.";
      showToast(msg, "error");
    } finally {
      setReassigningGroupId(null);
    }
  };

  // Filtered employees for the multi-select picker
  const filteredEmployeesForPicker = useMemo(() => {
    return employees.filter((emp) => {
      const name = emp.user_id?.name || "";
      const code = emp.employee_code || "";
      const desig = emp.designation || "";
      const dept = emp.department_id?.departmentName || "";

      const matchesSearch =
        name.toLowerCase().includes(empSearch.toLowerCase()) ||
        code.toLowerCase().includes(empSearch.toLowerCase()) ||
        desig.toLowerCase().includes(empSearch.toLowerCase());

      const matchesDept =
        deptFilter === "all" ||
        String(emp.department_id?._id || emp.department_id) === String(deptFilter) ||
        dept.toLowerCase() === deptFilter.toLowerCase();

      return matchesSearch && matchesDept;
    });
  }, [employees, empSearch, deptFilter]);

  const toggleEmployeeSelection = (empId) => {
    const current = new Set(groupForm.employee_ids);
    if (current.has(empId)) {
      current.delete(empId);
    } else {
      current.add(empId);
    }
    setGroupForm({ ...groupForm, employee_ids: Array.from(current) });
  };

  const handleSelectAllFiltered = () => {
    const filteredIds = filteredEmployeesForPicker.map((e) => e._id);
    const combined = new Set([...groupForm.employee_ids, ...filteredIds]);
    setGroupForm({ ...groupForm, employee_ids: Array.from(combined) });
  };

  const handleClearSelection = () => {
    setGroupForm({ ...groupForm, employee_ids: [] });
  };

  // Map employee ID to current assigned group name (for informational badges)
  const employeeGroupMap = useMemo(() => {
    const map = {};
    groups.forEach((g) => {
      (g.employee_ids || []).forEach((e) => {
        const id = e._id || e;
        if (id) {
          map[String(id)] = {
            groupId: g._id,
            groupName: g.name,
            shiftName: g.shift_id?.name || "Shift",
          };
        }
      });
    });
    return map;
  }, [groups]);

  // =========================================================================
  // VIEW & MANAGE MEMBERS MODAL
  // =========================================================================

  const handleOpenMembersModal = (group) => {
    setViewingGroup(group);
    setAddingMembersMode(false);
    setSelectedNewMemberIds([]);
    setIsMembersModalOpen(true);
  };

  const handleRemoveMember = async (empId, empName) => {
    if (!window.confirm(`Remove ${empName || "this employee"} from group "${viewingGroup.name}"?`)) {
      return;
    }

    try {
      await removeEmployeeFromGroup(viewingGroup._id, empId);
      showToast(`${empName || "Employee"} removed from group.`, "success");
      // Update local state
      const updatedGroup = {
        ...viewingGroup,
        employee_ids: viewingGroup.employee_ids.filter((e) => String(e._id || e) !== String(empId)),
      };
      setViewingGroup(updatedGroup);
      await fetchData();
    } catch (err) {
      showToast(err?.message || "Failed to remove member.", "error");
    }
  };

  const handleAddSelectedMembers = async () => {
    if (selectedNewMemberIds.length === 0) return;
    try {
      setMembersSubmitting(true);
      await addEmployeesToGroup(viewingGroup._id, selectedNewMemberIds);
      showToast(`Added ${selectedNewMemberIds.length} employee(s) to "${viewingGroup.name}".`, "success");
      setSelectedNewMemberIds([]);
      setAddingMembersMode(false);
      await fetchData();
      // Re-fetch current viewing group
      const refreshedGroups = await getAllShiftGroups();
      const updated = refreshedGroups?.data?.find((g) => g._id === viewingGroup._id);
      if (updated) setViewingGroup(updated);
    } catch (err) {
      showToast(err?.message || "Failed to add members.", "error");
    } finally {
      setMembersSubmitting(false);
    }
  };

  // Available employees to add to current viewing group
  const availableEmployeesForViewingGroup = useMemo(() => {
    if (!viewingGroup) return [];
    const currentMemberIds = new Set((viewingGroup.employee_ids || []).map((e) => String(e._id || e)));
    return employees.filter((e) => !currentMemberIds.has(String(e._id)));
  }, [employees, viewingGroup]);

  return (
    <div className="shifts-page-container">
      {/* Page Header */}
      <div className="shifts-header-card">
        <div className="shifts-header-title-block">
          <div className="shifts-header-icon-wrapper">
            <FiClock size={28} />
          </div>
          <div>
            <h1>Shifts & Roster Management</h1>
            <p>Define operational work shifts, organize employees into groups, and manage team rosters with real-time schedule notifications.</p>
          </div>
        </div>

        <div className="shifts-header-actions">
          <button className="btn-shift-primary" onClick={handleOpenAddShift}>
            <FiPlus size={16} />
            <span>Define Shift</span>
          </button>
          <button className="btn-shift-accent" onClick={handleOpenCreateGroup}>
            <FiLayers size={16} />
            <span>Create Shift Group</span>
          </button>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="shifts-metrics-grid">
        <div className="shift-metric-card">
          <div className="metric-icon-box indigo">
            <FiClock size={22} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Total Shifts</span>
            <span className="metric-value">{metrics.totalShifts}</span>
          </div>
        </div>

        <div className="shift-metric-card">
          <div className="metric-icon-box emerald">
            <FiCheckCircle size={22} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Active Shifts</span>
            <span className="metric-value">{metrics.activeShifts}</span>
          </div>
        </div>

        <div className="shift-metric-card">
          <div className="metric-icon-box purple">
            <FiLayers size={22} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Shift Groups</span>
            <span className="metric-value">{metrics.totalGroups}</span>
          </div>
        </div>

        <div className="shift-metric-card">
          <div className="metric-icon-box cyan">
            <FiUsers size={22} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Assigned Employees</span>
            <span className="metric-value">{metrics.assignedEmployees}</span>
          </div>
        </div>
      </div>

      {/* SECTION 1: DEFINE SHIFTS */}
      <div className="shifts-section-card">
        <div className="section-card-header">
          <div>
            <h2>Work Shifts</h2>
            <p>Standardized working hours, timing boundaries, and shift classifications.</p>
          </div>
          <button className="btn-section-action" onClick={handleOpenAddShift}>
            <FiPlus size={15} />
            <span>Add Shift</span>
          </button>
        </div>

        {loading ? (
          <div className="shifts-table-loading">Loading shifts...</div>
        ) : shifts.length === 0 ? (
          <div className="shifts-empty-state">
            <FiClock size={42} className="empty-icon" />
            <h3>No Shifts Defined</h3>
            <p>Define your organization's first work shift (e.g. Morning, Evening, or Night Shift) to start scheduling teams.</p>
            <button className="btn-shift-primary" onClick={handleOpenAddShift}>
              <FiPlus size={16} /> Define First Shift
            </button>
          </div>
        ) : (
          <div className="shifts-table-wrapper">
            <table className="shifts-table">
              <thead>
                <tr>
                  <th>Shift Name</th>
                  <th>Timings (24-Hour)</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Assigned Groups</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((shift) => {
                  const { duration, isOvernight } = getShiftTimingInfo(shift.start_time, shift.end_time);
                  return (
                    <tr key={shift._id}>
                      <td>
                        <div className="shift-name-cell">
                          <span
                            className="shift-color-bullet"
                            style={{ backgroundColor: shift.color || "#4f46e5" }}
                          />
                          <span className="shift-name-text">{shift.name}</span>
                        </div>
                      </td>
                      <td>
                        <div className="shift-timings-cell">
                          <span className="timing-text">
                            {shift.start_time} – {shift.end_time}
                          </span>
                          {isOvernight && (
                            <span className="overnight-badge" title="Overnight schedule crosses midnight">
                              <FiMoon size={11} /> Overnight (+1 day)
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="duration-tag">{duration}</span>
                      </td>
                      <td>
                        <span className={`status-pill ${shift.is_active ? "active" : "inactive"}`}>
                          {shift.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <span className="group-count-pill">
                          {shift.assignedGroupCount || 0} group{shift.assignedGroupCount === 1 ? "" : "s"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div className="table-actions">
                          <button
                            className="action-btn edit"
                            onClick={() => handleOpenEditShift(shift)}
                            title="Edit Shift"
                          >
                            <FiEdit2 size={15} />
                          </button>
                          <button
                            className="action-btn delete"
                            onClick={() => handleDeleteShift(shift)}
                            title="Delete Shift"
                          >
                            <FiTrash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 2: SHIFT GROUPS & ROSTER */}
      <div className="shifts-section-card">
        <div className="section-card-header">
          <div>
            <h2>Shift Groups & Bulk Roster</h2>
            <p>Group employees and assign schedules in bulk. Changing a group's shift updates all members instantly.</p>
          </div>
          <button className="btn-section-action" onClick={handleOpenCreateGroup}>
            <FiPlus size={15} />
            <span>Create Group</span>
          </button>
        </div>

        {loading ? (
          <div className="shifts-table-loading">Loading shift groups...</div>
        ) : groups.length === 0 ? (
          <div className="shifts-empty-state">
            <FiLayers size={42} className="empty-icon" />
            <h3>No Shift Groups Created</h3>
            <p>Create a shift group (e.g. "Alpha Support", "Night Team") and select employees to assign them to a common shift.</p>
            <button className="btn-shift-accent" onClick={handleOpenCreateGroup}>
              <FiLayers size={16} /> Create Shift Group
            </button>
          </div>
        ) : (
          <div className="shifts-table-wrapper">
            <table className="shifts-table">
              <thead>
                <tr>
                  <th>Group Name</th>
                  <th>Current Shift</th>
                  <th>Quick Reassign Shift</th>
                  <th>Members</th>
                  <th>Last Assigned</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => {
                  const shift = group.shift_id;
                  const memberCount = group.employee_ids?.length || 0;
                  const isReassigning = reassigningGroupId === group._id;

                  return (
                    <tr key={group._id}>
                      <td>
                        <div className="group-name-cell">
                          <div className="group-avatar-icon">
                            <FiLayers size={16} />
                          </div>
                          <div>
                            <span className="group-name-text">{group.name}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        {shift ? (
                          <div
                            className="shift-chip"
                            style={{
                              borderColor: shift.color || "#4f46e5",
                              backgroundColor: `${shift.color || "#4f46e5"}15`,
                              color: shift.color || "#4f46e5",
                            }}
                          >
                            <span
                              className="chip-dot"
                              style={{ backgroundColor: shift.color || "#4f46e5" }}
                            />
                            <strong>{shift.name}</strong>
                            <span className="chip-timing">
                              ({shift.start_time} – {shift.end_time})
                            </span>
                          </div>
                        ) : (
                          <span className="no-shift-tag">Unassigned</span>
                        )}
                      </td>
                      <td>
                        <div className="quick-reassign-container">
                          <select
                            className="quick-reassign-select"
                            value={shift?._id || ""}
                            disabled={isReassigning}
                            onChange={(e) => handleQuickReassignShift(group, e.target.value)}
                            title="Select another shift to reassign all members immediately"
                          >
                            <option value="" disabled>
                              Select shift to reassign...
                            </option>
                            {shifts
                              .filter((s) => s.is_active)
                              .map((s) => (
                                <option key={s._id} value={s._id}>
                                  {s.name} ({s.start_time} - {s.end_time})
                                </option>
                              ))}
                          </select>
                          {isReassigning && <span className="reassign-spinner" />}
                        </div>
                      </td>
                      <td>
                        <button
                          className="member-count-btn"
                          onClick={() => handleOpenMembersModal(group)}
                          title="Click to view and manage members"
                        >
                          <FiUsers size={14} />
                          <span>{memberCount} employee{memberCount === 1 ? "" : "s"}</span>
                        </button>
                      </td>
                      <td>
                        <span className="date-muted">
                          {group.assigned_at
                            ? new Date(group.assigned_at).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "—"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div className="table-actions">
                          <button
                            className="action-btn edit"
                            onClick={() => handleOpenEditGroup(group)}
                            title="Edit Group"
                          >
                            <FiEdit2 size={15} />
                          </button>
                          <button
                            className="action-btn delete"
                            onClick={() => handleDeleteGroup(group)}
                            title="Delete Group"
                          >
                            <FiTrash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =====================================================================
          MODAL 1: ADD / EDIT SHIFT
      ===================================================================== */}
      {isShiftModalOpen && (
        <div className="shift-modal-overlay" onClick={() => setIsShiftModalOpen(false)}>
          <div className="shift-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="shift-modal-header">
              <h3>{editingShift ? "Edit Work Shift" : "Define New Work Shift"}</h3>
              <button className="modal-close-btn" onClick={() => setIsShiftModalOpen(false)}>
                <FiX size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveShift} className="shift-modal-form">
              {shiftError && (
                <div className="modal-error-banner">
                  <FiAlertCircle size={16} />
                  <span>{shiftError}</span>
                </div>
              )}

              <div className="form-group">
                <label>Shift Name *</label>
                <input
                  type="text"
                  className="shift-input"
                  placeholder="e.g. Morning Shift, General Shift, Night Shift"
                  value={shiftForm.name}
                  onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Start Time (24h) *</label>
                  <input
                    type="time"
                    className="shift-input"
                    value={shiftForm.start_time}
                    onChange={(e) => setShiftForm({ ...shiftForm, start_time: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>End Time (24h) *</label>
                  <input
                    type="time"
                    className="shift-input"
                    value={shiftForm.end_time}
                    onChange={(e) => setShiftForm({ ...shiftForm, end_time: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Timing Preview & Overnight Helper */}
              {(() => {
                const { duration, isOvernight } = getShiftTimingInfo(
                  shiftForm.start_time,
                  shiftForm.end_time
                );
                return (
                  <div className={`timing-preview-box ${isOvernight ? "overnight" : ""}`}>
                    <div className="timing-preview-icon">
                      {isOvernight ? <FiMoon size={18} /> : <FiSun size={18} />}
                    </div>
                    <div className="timing-preview-content">
                      <div className="timing-preview-title">
                        {isOvernight ? "Overnight Shift Detected" : "Standard Work Shift"}
                      </div>
                      <div className="timing-preview-desc">
                        Duration: <strong>{duration || "—"}</strong>
                        {isOvernight && " (ends the following day)."}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Color Presets */}
              <div className="form-group">
                <label>Badge Color Accent</label>
                <div className="color-presets-row">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      className={`color-chip-btn ${shiftForm.color === c.hex ? "selected" : ""}`}
                      style={{ backgroundColor: c.hex }}
                      onClick={() => setShiftForm({ ...shiftForm, color: c.hex })}
                      title={c.name}
                    >
                      {shiftForm.color === c.hex && <FiCheck size={14} color="#fff" />}
                    </button>
                  ))}
                  <input
                    type="color"
                    className="custom-color-picker"
                    value={shiftForm.color}
                    onChange={(e) => setShiftForm({ ...shiftForm, color: e.target.value })}
                    title="Custom color"
                  />
                </div>
              </div>

              {/* Active Toggle */}
              <div className="form-checkbox-row">
                <label className="checkbox-label-toggle">
                  <input
                    type="checkbox"
                    checked={shiftForm.is_active}
                    onChange={(e) => setShiftForm({ ...shiftForm, is_active: e.target.checked })}
                  />
                  <span>Shift is Active (available for group assignment)</span>
                </label>
              </div>

              <div className="shift-modal-footer">
                <button
                  type="button"
                  className="btn-modal-secondary"
                  onClick={() => setIsShiftModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-modal-primary"
                  disabled={shiftSubmitting}
                >
                  {shiftSubmitting ? "Saving..." : editingShift ? "Update Shift" : "Create Shift"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: CREATE / EDIT SHIFT GROUP (WITH MULTI-SELECT PICKER)
      ===================================================================== */}
      {isGroupModalOpen && (
        <div className="shift-modal-overlay" onClick={() => setIsGroupModalOpen(false)}>
          <div className="shift-modal-dialog wide" onClick={(e) => e.stopPropagation()}>
            <div className="shift-modal-header">
              <h3>{editingGroup ? "Edit Shift Group" : "Create Shift Group"}</h3>
              <button className="modal-close-btn" onClick={() => setIsGroupModalOpen(false)}>
                <FiX size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveGroup} className="shift-modal-form">
              {groupError && (
                <div className="modal-error-banner">
                  <FiAlertCircle size={16} />
                  <span>{groupError}</span>
                </div>
              )}

              <div className="form-row-2">
                <div className="form-group">
                  <label>Group Name *</label>
                  <input
                    type="text"
                    className="shift-input"
                    placeholder="e.g. Operations Alpha, Support Night Team"
                    value={groupForm.name}
                    onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <label style={{ margin: 0 }}>Assign Shift *</label>
                    {shifts.filter((s) => s.is_active).length === 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsGroupModalOpen(false);
                          handleOpenAddShift();
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#6366f1",
                          cursor: "pointer",
                          fontSize: "12px",
                          fontWeight: "600",
                          padding: 0,
                          textDecoration: "underline",
                        }}
                      >
                        + Define Shift First
                      </button>
                    )}
                  </div>
                  {shifts.filter((s) => s.is_active).length === 0 ? (
                    <div
                      style={{
                        padding: "8px 12px",
                        background: "rgba(239, 68, 68, 0.08)",
                        border: "1px dashed rgba(239, 68, 68, 0.4)",
                        borderRadius: "8px",
                        fontSize: "12px",
                        color: "#ef4444",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "8px",
                      }}
                    >
                      <span>No active shifts found.</span>
                      <button
                        type="button"
                        className="btn-shift-primary"
                        style={{ padding: "4px 8px", fontSize: "11px", whiteSpace: "nowrap" }}
                        onClick={() => {
                          setIsGroupModalOpen(false);
                          handleOpenAddShift();
                        }}
                      >
                        + Add Shift
                      </button>
                    </div>
                  ) : (
                    <select
                      className="shift-select"
                      value={groupForm.shift_id}
                      onChange={(e) => setGroupForm({ ...groupForm, shift_id: e.target.value })}
                      required
                    >
                      <option value="" disabled>
                        Select active shift...
                      </option>
                      {shifts
                        .filter((s) => s.is_active)
                        .map((s) => (
                          <option key={s._id} value={s._id}>
                            {s.name} ({s.start_time} – {s.end_time})
                          </option>
                        ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Employee Multi-Select Picker */}
              <div className="picker-container">
                <div className="picker-header">
                  <div className="picker-header-title">
                    <label>Select Group Members ({groupForm.employee_ids.length} selected)</label>
                    <span className="picker-subtitle">
                      All selected employees will be assigned to this shift and notified immediately.
                    </span>
                  </div>
                  <div className="picker-shortcuts">
                    <button
                      type="button"
                      className="picker-shortcut-btn"
                      onClick={handleSelectAllFiltered}
                    >
                      Select All Filtered ({filteredEmployeesForPicker.length})
                    </button>
                    <button
                      type="button"
                      className="picker-shortcut-btn clear"
                      onClick={handleClearSelection}
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                {/* Search & Department Filter Bar */}
                <div className="picker-filters-bar">
                  <div className="picker-search-box">
                    <FiSearch size={15} className="picker-search-icon" />
                    <input
                      type="text"
                      placeholder="Search employees by name, code, designation..."
                      value={empSearch}
                      onChange={(e) => setEmpSearch(e.target.value)}
                    />
                    {empSearch && (
                      <button
                        type="button"
                        className="picker-clear-search"
                        onClick={() => setEmpSearch("")}
                      >
                        <FiX size={14} />
                      </button>
                    )}
                  </div>

                  <div className="picker-dept-box">
                    <FiFilter size={15} className="picker-dept-icon" />
                    <select
                      value={deptFilter}
                      onChange={(e) => setDeptFilter(e.target.value)}
                    >
                      <option value="all">All Departments</option>
                      {departments.map((d) => (
                        <option key={d._id} value={d._id}>
                          {d.departmentName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Scrollable Checkbox List */}
                <div className="picker-list">
                  {filteredEmployeesForPicker.length === 0 ? (
                    <div className="picker-empty">No matching employees found.</div>
                  ) : (
                    filteredEmployeesForPicker.map((emp) => {
                      const isSelected = groupForm.employee_ids.includes(emp._id);
                      const currentAssigned = employeeGroupMap[String(emp._id)];
                      const isInDifferentGroup =
                        currentAssigned &&
                        editingGroup &&
                        String(currentAssigned.groupId) !== String(editingGroup._id);

                      return (
                        <label
                          key={emp._id}
                          className={`picker-item ${isSelected ? "selected" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleEmployeeSelection(emp._id)}
                          />
                          <div className="picker-emp-avatar">
                            {(emp.user_id?.name || "E").charAt(0).toUpperCase()}
                          </div>
                          <div className="picker-emp-info">
                            <span className="picker-emp-name">
                              {emp.user_id?.name || "Unnamed Employee"}
                            </span>
                            <span className="picker-emp-meta">
                              {emp.employee_code || "EMP"} · {emp.designation || "Staff"} ·{" "}
                              {emp.department_id?.departmentName || "General"}
                            </span>
                          </div>
                          {currentAssigned && (
                            <span
                              className={`picker-assigned-badge ${
                                isInDifferentGroup ? "different-group" : ""
                              }`}
                              title={`Currently in ${currentAssigned.groupName}`}
                            >
                              In {currentAssigned.groupName} ({currentAssigned.shiftName})
                            </span>
                          )}
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="shift-modal-footer">
                <button
                  type="button"
                  className="btn-modal-secondary"
                  onClick={() => setIsGroupModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-modal-primary"
                  disabled={groupSubmitting || shifts.filter((s) => s.is_active).length === 0}
                >
                  {groupSubmitting
                    ? "Saving Group..."
                    : editingGroup
                    ? "Update Group"
                    : `Create Group (${groupForm.employee_ids.length} Members)`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 3: VIEW & MANAGE GROUP MEMBERS
      ===================================================================== */}
      {isMembersModalOpen && viewingGroup && (
        <div className="shift-modal-overlay" onClick={() => setIsMembersModalOpen(false)}>
          <div className="shift-modal-dialog wide" onClick={(e) => e.stopPropagation()}>
            <div className="shift-modal-header">
              <div className="members-modal-title">
                <h3>Members of "{viewingGroup.name}"</h3>
                <span className="members-modal-subtitle">
                  Shift: <strong>{viewingGroup.shift_id?.name || "Unassigned"}</strong> (
                  {viewingGroup.shift_id?.start_time} – {viewingGroup.shift_id?.end_time})
                </span>
              </div>
              <button className="modal-close-btn" onClick={() => setIsMembersModalOpen(false)}>
                <FiX size={20} />
              </button>
            </div>

            <div className="members-modal-body">
              <div className="members-toolbar">
                <span className="members-count-badge">
                  {viewingGroup.employee_ids?.length || 0} active members
                </span>

                {!addingMembersMode && (
                  <button
                    className="btn-add-members-toggle"
                    onClick={() => setAddingMembersMode(true)}
                  >
                    <FiUserPlus size={15} />
                    <span>Add Members</span>
                  </button>
                )}
              </div>

              {/* Add Members Drawer View */}
              {addingMembersMode && (
                <div className="add-members-panel">
                  <div className="add-members-header">
                    <h4>Select Employees to Add to "{viewingGroup.name}"</h4>
                    <button
                      className="btn-cancel-add"
                      onClick={() => {
                        setAddingMembersMode(false);
                        setSelectedNewMemberIds([]);
                      }}
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="picker-list compact">
                    {availableEmployeesForViewingGroup.length === 0 ? (
                      <div className="picker-empty">All active employees are already in this group.</div>
                    ) : (
                      availableEmployeesForViewingGroup.map((emp) => {
                        const isChecked = selectedNewMemberIds.includes(emp._id);
                        return (
                          <label key={emp._id} className="picker-item compact">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setSelectedNewMemberIds(selectedNewMemberIds.filter((id) => id !== emp._id));
                                } else {
                                  setSelectedNewMemberIds([...selectedNewMemberIds, emp._id]);
                                }
                              }}
                            />
                            <div className="picker-emp-info">
                              <span className="picker-emp-name">{emp.user_id?.name}</span>
                              <span className="picker-emp-meta">
                                {emp.employee_code} · {emp.designation} · {emp.department_id?.departmentName}
                              </span>
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>

                  <div className="add-members-actions">
                    <button
                      className="btn-modal-primary"
                      disabled={selectedNewMemberIds.length === 0 || membersSubmitting}
                      onClick={handleAddSelectedMembers}
                    >
                      {membersSubmitting
                        ? "Adding..."
                        : `Add ${selectedNewMemberIds.length} Selected Member(s)`}
                    </button>
                  </div>
                </div>
              )}

              {/* Existing Members Table */}
              <div className="members-list-wrapper">
                {(!viewingGroup.employee_ids || viewingGroup.employee_ids.length === 0) ? (
                  <div className="members-empty">
                    <FiUsers size={32} />
                    <p>This group currently has no members.</p>
                  </div>
                ) : (
                  <table className="shifts-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Code</th>
                        <th>Designation</th>
                        <th>Department</th>
                        <th style={{ textAlign: "right" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewingGroup.employee_ids.map((emp) => {
                        const empId = emp._id || emp;
                        const name = emp.user_id?.name || "Employee";
                        const email = emp.user_id?.email || "";
                        const code = emp.employee_code || "—";
                        const desig = emp.designation || "—";
                        const dept = emp.department_id?.departmentName || "—";

                        return (
                          <tr key={empId}>
                            <td>
                              <div className="member-name-cell">
                                <div className="member-avatar">
                                  {name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="member-name">{name}</div>
                                  <div className="member-email">{email}</div>
                                </div>
                              </div>
                            </td>
                            <td>{code}</td>
                            <td>{desig}</td>
                            <td>{dept}</td>
                            <td style={{ textAlign: "right" }}>
                              <button
                                className="action-btn delete"
                                onClick={() => handleRemoveMember(empId, name)}
                                title="Remove from this group"
                              >
                                <FiUserMinus size={15} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="shift-modal-footer">
              <button
                type="button"
                className="btn-modal-secondary"
                onClick={() => setIsMembersModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
