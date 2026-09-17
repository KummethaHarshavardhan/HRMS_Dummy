import express from "express";
import dotenv from "dotenv";
dotenv.config();

import cookieParser from "cookie-parser";
import cors from "cors";

import connectDB from "./config/db.js";
import { backfillEmployeeCodes, syncUsersToEmployees } from "./controllers/EmployeeController.js";

import route from "./routes/UserRoute.js";
import departmentRoutes from "./routes/departmentRoutes.js";
import roleRoutes from "./routes/roleRoutes.js";
import employeeRoutes from "./routes/employeeRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import leaveRoutes from "./routes/leaveRoutes.js";
import leaveBalanceRoutes from "./routes/leaveBalanceRoutes.js";
import candidateRoutes from "./routes/candidateRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import assignmentRoutes from "./routes/assignmentRoutes.js";
import payslipRoutes from "./routes/payslipRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import submissionRoutes from "./routes/submissionRoutes.js";
import salaryRoutes from "./routes/salaryRoutes.js";
import payrollRoutes from "./routes/payrollRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import progressRoutes from "./routes/progressRoutes.js";
import taskReportRoutes from "./routes/taskReportRoutes.js";
import superAdminRoutes from "./routes/superAdminRoutes.js";
import documentRoutes from "./routes/documentRoutes.js";
import onboardingRoutes from "./routes/onboardingRoutes.js";
import offboardingRoutes from "./routes/offboardingRoutes.js";
import holidayRoutes from "./routes/holidayRoutes.js";
import assetRoutes from "./routes/assetRoutes.js";
import { shiftRouter, shiftGroupRouter } from "./routes/shiftRoutes.js";
import wfhRoutes from "./routes/wfhRoutes.js";
import { seedDefaultDepartments } from "./services/departmentService.js";
import { seedSuperAdmin } from "./controllers/superAdminController.js";
import { seedInitialTaskData } from "./scripts/seedTaskData.js";
import { syncEmployeesToCandidates } from "./controllers/candidateController.js";
import { syncOffboardedEmployees } from "./controllers/offboardingController.js";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.js";

const app = express();

app.use(cors({
    origin: "http://localhost:5173",
    credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

connectDB().then(async () => {
    await seedDefaultDepartments();
    await seedSuperAdmin();
    await syncUsersToEmployees();
    await backfillEmployeeCodes();
    await syncEmployeesToCandidates();
    await syncOffboardedEmployees();
    await seedInitialTaskData();
});

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "HRMS API Server is Running",
    });
});

app.use("/api", route);
app.use("/api/departments", departmentRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/leave", leaveRoutes);
app.use("/api/leave-balance", leaveBalanceRoutes);
app.use("/api/candidates", candidateRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/payslips", payslipRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/submissions", submissionRoutes);
app.use("/api/salaries", salaryRoutes);
app.use("/api/payrolls", payrollRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/super-admin", superAdminRoutes);
app.use("/api/task-reports", taskReportRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/offboarding", offboardingRoutes);
app.use("/api/holidays", holidayRoutes);
app.use("/api/assets", assetRoutes);
app.use("/api/shifts", shiftRouter);
app.use("/api/shift-groups", shiftGroupRouter);
app.use("/api/wfh-requests", wfhRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});