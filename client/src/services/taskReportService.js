const API_BASE = "/api/task-reports";

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

export const taskReportService = {
  getOverview: async () => {
    const res = await fetch(`${API_BASE}/overview`, { method: "GET", headers: getAuthHeaders() });
    return handleResponse(res);
  },

  getCandidateReports: async (params = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== "") {
        searchParams.append(key, val);
      }
    });
    const url = `${API_BASE}/candidates${searchParams.toString() ? "?" + searchParams.toString() : ""}`;
    const res = await fetch(url, { method: "GET", headers: getAuthHeaders() });
    return handleResponse(res);
  },

  getTeamReports: async () => {
    const res = await fetch(`${API_BASE}/teams`, { method: "GET", headers: getAuthHeaders() });
    return handleResponse(res);
  },

  getTaskReports: async (params = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== "") {
        searchParams.append(key, val);
      }
    });
    const url = `${API_BASE}/tasks${searchParams.toString() ? "?" + searchParams.toString() : ""}`;
    const res = await fetch(url, { method: "GET", headers: getAuthHeaders() });
    return handleResponse(res);
  },
};

export default taskReportService;