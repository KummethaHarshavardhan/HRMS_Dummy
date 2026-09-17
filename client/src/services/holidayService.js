const API_BASE = "/api/holidays";

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

export const getAllHolidays = async ({ year, month, type, search, organizationId } = {}) => {
  const params = new URLSearchParams();
  if (year) params.append("year", year);
  if (month !== undefined && month !== null && month !== "") params.append("month", month);
  if (type && type !== "ALL") params.append("type", type);
  if (search) params.append("search", search);
  if (organizationId) params.append("organizationId", organizationId);

  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${API_BASE}${query}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

export const getHolidayById = async (id) => {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

export const createHoliday = async (payload) => {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
};

export const updateHoliday = async (id, payload) => {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
};

export const deleteHoliday = async (id) => {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

export const bulkImportHolidays = async (holidays, organizationId) => {
  const payload = { holidays };
  if (organizationId) {
    payload.organizationId = organizationId;
  }
  const res = await fetch(`${API_BASE}/bulk`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
};
