import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { normalizeRole } from '../utils/permission';
import Payroll from '../pages/Payroll/Payroll';
import PayrollDashboard from '../pages/Payroll/PayrollDashboard/PayrollDashboard';
import SalaryList from '../pages/Payroll/SalaryList/SalaryList';
import AddSalary from '../pages/Payroll/AddSalary/AddSalary';
import EditSalary from '../pages/Payroll/EditSalary/EditSalary';
import SalaryDetails from '../pages/Payroll/SalaryDetails/SalaryDetails';
import PayrollHistory from '../pages/Payroll/PayrollHistory/PayrollHistory';
import PayrollDetails from '../pages/Payroll/PayrollDetails/PayrollDetails';

export default function PayrollRoutes() {
  const { user } = useAuth();
  const isEmployee = normalizeRole(user?.role) === 'employee';

  return (
    <Routes>
      <Route element={<Payroll />}>
        <Route index element={<Navigate to={isEmployee ? "my-payroll" : "dashboard"} replace />} />
        <Route path="dashboard" element={isEmployee ? <Navigate to="/payroll/my-payroll" replace /> : <PayrollDashboard />} />
        
        {/* My Payroll Sub-route */}
        <Route path="my-payroll" element={<PayrollHistory scope="my" />} />

        {/* Salary Sub-routes (retained for Salary Structures action) */}
        <Route path="salaries" element={isEmployee ? <Navigate to="/payroll/my-payroll" replace /> : <SalaryList />} />
        <Route path="salaries/add" element={isEmployee ? <Navigate to="/payroll/my-payroll" replace /> : <AddSalary />} />
        <Route path="salaries/:id" element={isEmployee ? <Navigate to="/payroll/my-payroll" replace /> : <SalaryDetails />} />
        <Route path="salaries/:id/edit" element={isEmployee ? <Navigate to="/payroll/my-payroll" replace /> : <EditSalary />} />

        {/* Employees Payroll History Sub-routes */}
        <Route path="history" element={isEmployee ? <Navigate to="/payroll/my-payroll" replace /> : <PayrollHistory scope="employees" />} />
        <Route path=":id" element={<PayrollDetails />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to={isEmployee ? "my-payroll" : "dashboard"} replace />} />
      </Route>
    </Routes>
  );
}