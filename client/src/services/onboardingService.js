const API_BASE = "/api/onboarding";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const handleResponse = async (res) => {
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!res.ok) {
    throw new Error(data?.message || data?.error || "Request failed");
  }
  return data;
};

export const createOnboarding = async (payload) => {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
};

export const getAllOnboarding = async ({ status = "ALL", search = "" } = {}) => {
  const params = new URLSearchParams();
  if (status && status !== "ALL") params.append("status", status);
  if (search) params.append("search", search);

  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${API_BASE}${query}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

export const getOnboardingById = async (id) => {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

export const getEmployeeOnboarding = async (employeeId = "me") => {
  const res = await fetch(`${API_BASE}/employee/${employeeId}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

export const updateOnboardingTask = async (processId, taskId, updates) => {
  const res = await fetch(`${API_BASE}/${processId}/task/${taskId}`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify(updates),
  });
  return handleResponse(res);
};

export const updateOnboardingStatus = async (processId, status) => {
  const res = await fetch(`${API_BASE}/${processId}/status`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify({ status }),
  });
  return handleResponse(res);
};

export const getEmployeeLifecycleHistory = async (employeeId) => {
  const res = await fetch(`${API_BASE}/employee/${employeeId}/history`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

