const API_BASE = "/api/reviews";

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

export const reviewService = {
  getReviewQueue: async (params = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== "") {
        searchParams.append(key, val);
      }
    });
    const url = `${API_BASE}/pending${searchParams.toString() ? "?" + searchParams.toString() : ""}`;
    const res = await fetch(url, { method: "GET", headers: getAuthHeaders() });
    return handleResponse(res);
  },

  getReviewById: async (id) => {
    const res = await fetch(`${API_BASE}/${id}`, { method: "GET", headers: getAuthHeaders() });
    return handleResponse(res);
  },

  approveSubmission: async (submissionId, comments = "") => {
    const res = await fetch(`${API_BASE}/${submissionId}/approve`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ comments }),
    });
    return handleResponse(res);
  },

  reworkSubmission: async (submissionId, comments) => {
    const res = await fetch(`${API_BASE}/${submissionId}/rework`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ comments }),
    });
    return handleResponse(res);
  },

  getAssignmentReviews: async (assignmentId) => {
    const res = await fetch(`${API_BASE}/assignment/${assignmentId}`, {
      method: "GET",
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },
};

export default reviewService;