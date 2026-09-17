const API_BASE = "/api/assignments";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
};

const handleResponse = async (res) => {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.message || data?.errors || "Request failed");
  }
  return data;
};

export const assignmentService = {
  getAssignments: async (params = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== "") {
        searchParams.append(key, val);
      }
    });
    const url = `${API_BASE}${searchParams.toString() ? "?" + searchParams.toString() : ""}`;
    const res = await fetch(url, { method: "GET", headers: getAuthHeaders() });
    return handleResponse(res);
  },

  getAssignmentById: async (id) => {
    const res = await fetch(`${API_BASE}/${id}`, { method: "GET", headers: getAuthHeaders() });
    return handleResponse(res);
  },

  createAssignment: async (assignmentData) => {
    const res = await fetch(API_BASE, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(assignmentData),
    });
    return handleResponse(res);
  },

  updateAssignment: async (id, assignmentData) => {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(assignmentData),
    });
    return handleResponse(res);
  },

  reassignAssignment: async (id, reassignData) => {
    const res = await fetch(`${API_BASE}/${id}/reassign`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(reassignData),
    });
    return handleResponse(res);
  },
};

export default assignmentService;
