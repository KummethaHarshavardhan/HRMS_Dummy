const API_BASE = "/api/assets";

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

export const getAllAssets = async ({ type = "ALL", status = "ALL", search = "" } = {}) => {
  const params = new URLSearchParams();
  if (type && type !== "ALL") params.append("type", type);
  if (status && status !== "ALL") params.append("status", status);
  if (search) params.append("search", search);

  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${API_BASE}${query}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

export const getAssetById = async (id) => {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

export const createAsset = async (payload) => {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
};

export const updateAsset = async (id, payload) => {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
};

export const deleteAsset = async (id) => {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

export const assignAsset = async ({ asset_id, employee_id, notes = "" }) => {
  const res = await fetch(`${API_BASE}/assign`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ asset_id, employee_id, notes }),
  });
  return handleResponse(res);
};

export const returnAsset = async ({
  assignment_id,
  asset_id,
  return_condition = "Good",
  notes = "",
}) => {
  const res = await fetch(`${API_BASE}/return`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ assignment_id, asset_id, return_condition, notes }),
  });
  return handleResponse(res);
};

export const getEmployeeAssets = async (employeeId = "me") => {
  const res = await fetch(`${API_BASE}/employee/${employeeId}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

export const getAssetHistory = async (assetId) => {
  const res = await fetch(`${API_BASE}/${assetId}/history`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

export const getAllAssignments = async ({ status = "ALL" } = {}) => {
  const params = new URLSearchParams();
  if (status && status !== "ALL") params.append("status", status);

  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${API_BASE}/assignments/all${query}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};
