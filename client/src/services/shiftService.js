const API_BASE_URL = "/api";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
};

const handleResponse = async (res) => {
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (err) {
    data = { message: text };
  }

  if (!res.ok) {
    const errorMsg = data?.message || "Request failed";
    const error = new Error(errorMsg);
    error.response = { data, status: res.status };
    throw error;
  }
  return data;
};

// ==========================================
// 1. Shift Definitions
// ==========================================

export const getAllShifts = async () => {
  const res = await fetch(`${API_BASE_URL}/shifts`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

export const createShift = async (shiftData) => {
  const res = await fetch(`${API_BASE_URL}/shifts`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(shiftData),
  });
  return handleResponse(res);
};

export const updateShift = async (id, shiftData) => {
  const res = await fetch(`${API_BASE_URL}/shifts/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(shiftData),
  });
  return handleResponse(res);
};

export const deleteShift = async (id) => {
  const res = await fetch(`${API_BASE_URL}/shifts/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

export const getMyShift = async () => {
  const res = await fetch(`${API_BASE_URL}/shifts/my-shift`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

// ==========================================
// 2. Shift Groups & Bulk Assignments
// ==========================================

export const getAllShiftGroups = async () => {
  const res = await fetch(`${API_BASE_URL}/shift-groups`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

export const createShiftGroup = async (groupData) => {
  const res = await fetch(`${API_BASE_URL}/shift-groups`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(groupData),
  });
  return handleResponse(res);
};

export const updateShiftGroup = async (id, groupData) => {
  const res = await fetch(`${API_BASE_URL}/shift-groups/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(groupData),
  });
  return handleResponse(res);
};

export const assignShiftToGroup = async (groupId, shiftId) => {
  const res = await fetch(`${API_BASE_URL}/shift-groups/${groupId}/assign-shift`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ shift_id: shiftId }),
  });
  return handleResponse(res);
};

export const addEmployeesToGroup = async (groupId, employeeIds) => {
  const res = await fetch(`${API_BASE_URL}/shift-groups/${groupId}/add-employees`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ employee_ids: employeeIds }),
  });
  return handleResponse(res);
};

export const removeEmployeeFromGroup = async (groupId, employeeId) => {
  const res = await fetch(`${API_BASE_URL}/shift-groups/${groupId}/employees/${employeeId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

export const deleteShiftGroup = async (groupId) => {
  const res = await fetch(`${API_BASE_URL}/shift-groups/${groupId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

export default {
  getAllShifts,
  createShift,
  updateShift,
  deleteShift,
  getMyShift,
  getAllShiftGroups,
  createShiftGroup,
  updateShiftGroup,
  assignShiftToGroup,
  addEmployeesToGroup,
  removeEmployeeFromGroup,
  deleteShiftGroup,
};
