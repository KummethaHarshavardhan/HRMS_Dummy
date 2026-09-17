const API_BASE = "/api/super-admin";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
};

const handleResponse = async (res) => {
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(data?.message || data?.error || `Request failed with status ${res.status}`);
  }
  return data;
};


// 1. Dashboard Stats
export const getSuperAdminDashboard = async () => {
  const res = await fetch(`${API_BASE}/dashboard`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

// 2. Organizations
export const getOrganizations = async () => {
  const res = await fetch(`${API_BASE}/organizations`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

export const createOrganization = async (orgData) => {
  const res = await fetch(`${API_BASE}/organizations`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(orgData),
  });
  return handleResponse(res);
};

export const getOrganizationById = async (id) => {
  const res = await fetch(`${API_BASE}/organizations/${id}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

export const updateOrganization = async (id, orgData) => {
  const res = await fetch(`${API_BASE}/organizations/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(orgData),
  });
  return handleResponse(res);
};

export const getOrganizationEmployees = async (id) => {
  const res = await fetch(`${API_BASE}/organizations/${id}/employees`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

export const toggleOrganizationStatus = async (id, status) => {
  const res = await fetch(`${API_BASE}/organizations/${id}/status`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify({ status }),
  });
  return handleResponse(res);
};

export const updateOrganizationLimit = async (id, memberLimit) => {
  const res = await fetch(`${API_BASE}/organizations/${id}/limit`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify({ memberLimit }),
  });
  return handleResponse(res);
};


// 3. HR Management
export const getAllHR = async () => {
  const res = await fetch(`${API_BASE}/hr`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

export const createHR = async (hrData) => {
  const res = await fetch(`${API_BASE}/hr`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(hrData),
  });
  return handleResponse(res);
};

export const updateHR = async (id, hrData) => {
  const res = await fetch(`${API_BASE}/hr/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(hrData),
  });
  return handleResponse(res);
};

// 4. Organization Usage & Limits
export const getOrganizationUsage = async () => {
  const res = await fetch(`${API_BASE}/usage`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};
