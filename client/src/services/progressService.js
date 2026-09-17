const API_BASE = "/api/progress";

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

export const progressService = {
  getOverview: async () => {
    const res = await fetch(API_BASE, { method: "GET", headers: getAuthHeaders() });
    return handleResponse(res);
  },

  getProgressOverview: async () => {
    const res = await fetch(API_BASE, { method: "GET", headers: getAuthHeaders() });
    return handleResponse(res);
  },

  getCandidatesProgress: async () => {
    const res = await fetch(`${API_BASE}/candidates`, { method: "GET", headers: getAuthHeaders() });
    return handleResponse(res);
  },

  getTeamsProgress: async () => {
    const res = await fetch(`${API_BASE}/teams`, { method: "GET", headers: getAuthHeaders() });
    return handleResponse(res);
  },

  updateProgress: async (assignmentId, progressData) => {
    const res = await fetch(`${API_BASE}/${assignmentId}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(progressData),
    });
    return handleResponse(res);
  },

  updateTaskProgress: async (assignmentId, progressData) => {
    const res = await fetch(`${API_BASE}/${assignmentId}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(progressData),
    });
    return handleResponse(res);
  },
};

export default progressService;