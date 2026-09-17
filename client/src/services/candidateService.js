const API_BASE = "/api/candidates";

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

export const candidateService = {
  getCandidates: async (params = {}) => {
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

  getCandidateById: async (id) => {
    const res = await fetch(`${API_BASE}/${id}`, { method: "GET", headers: getAuthHeaders() });
    return handleResponse(res);
  },

  createCandidate: async (candidateData) => {
    const res = await fetch(API_BASE, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(candidateData),
    });
    return handleResponse(res);
  },

  updateCandidate: async (id, candidateData) => {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(candidateData),
    });
    return handleResponse(res);
  },

  deleteCandidate: async (id) => {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  getFiltersMeta: async () => {
    const res = await fetch(`${API_BASE}/meta/filters`, { method: "GET", headers: getAuthHeaders() });
    return handleResponse(res);
  },
};

export default candidateService;
