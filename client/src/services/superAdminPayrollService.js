const API_BASE = "/api/super-admin/payroll";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
};

const handleResponse = async (res) => {
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (err) {
    data = { message: text };
  }
  if (!res.ok) {
    throw new Error(data?.message || data?.error || `Request failed with status ${res.status}`);
  }
  return data;
};

// Fetch all employees and HR payroll summary for Super Admin
export const getSuperAdminPayroll = async (month, year, organizationId) => {
  const params = new URLSearchParams();
  if (month) params.append("month", month);
  if (year) params.append("year", year);
  if (organizationId && organizationId !== "all") params.append("organizationId", organizationId);

  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${API_BASE}${query}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

// Pay single employee/HR monthly salary
export const paySingleSalary = async ({ employeeId, month, year, paymentMethod, notes }) => {
  const res = await fetch(`${API_BASE}/pay-single`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      employeeId,
      month,
      year,
      paymentMethod: paymentMethod || "Bank Transfer",
      notes: notes || "",
    }),
  });
  return handleResponse(res);
};

// Pay bonus to employee/HR (with 12-month lock enforcement)
export const payBonus = async ({ employeeId, amount, notes }) => {
  const res = await fetch(`${API_BASE}/pay-bonus`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      employeeId,
      amount,
      notes: notes || "",
    }),
  });
  return handleResponse(res);
};

// Pay all pending employees at once
export const payAllSalaries = async ({ month, year, paymentMethod, notes }) => {
  const res = await fetch(`${API_BASE}/pay-all`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      month,
      year,
      paymentMethod: paymentMethod || "Bank Transfer",
      notes: notes || "Bulk payroll disbursement by Super Admin",
    }),
  });
  return handleResponse(res);
};

// Update employee salary or account number config
export const updateEmployeePayrollConfig = async (employeeId, data) => {
  const res = await fetch(`${API_BASE}/config/${employeeId}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(res);
};