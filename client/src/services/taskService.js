const API_BASE = "/api/tasks";

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

export const taskService = {
  getTasks: async (params = {}) => {
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

  getTaskById: async (id) => {
    const res = await fetch(`${API_BASE}/${id}`, { method: "GET", headers: getAuthHeaders() });
    return handleResponse(res);
  },

  createTask: async (taskData) => {
    const res = await fetch(API_BASE, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(taskData),
    });
    return handleResponse(res);
  },

  updateTask: async (id, taskData) => {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(taskData),
    });
    return handleResponse(res);
  },

  deleteTask: async (id) => {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },
};

export default taskService;
