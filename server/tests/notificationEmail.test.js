import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import Notification from "../models/Notification.js";
import UserModel from "../models/UserModel.js";
import Employee from "../models/Employee.js";
import transporter from "../config/mail.js";
import {
  createNotification,
  sendDocumentVerificationNotification,
  notifyShiftAssignment,
  notifyWFHDecision,
  resolveNotificationSubject,
  buildNotificationEmailHtml,
} from "../services/notificationService.js";

describe("Centralized In-App & Email Notification System", () => {
  let originalNotificationCreate;
  let originalUserFindById;
  let originalEmployeeFindById;
  let originalEmployeeFindOne;
  let originalTransporterSendMail;
  let sentEmails = [];

  const mockOrg = { _id: "org_1", name: "Infinetra Innovations" };
  const mockUser = {
    _id: "user_emp_1",
    name: "Aarav Sharma",
    email: "aarav.sharma@example.com",
    organizationId: mockOrg,
  };

  const mockEmployee = {
    _id: "emp_1",
    employee_code: "INF001",
    employment_status: "Active",
    user_id: mockUser,
    organizationId: mockOrg,
  };

  beforeEach(() => {
    sentEmails = [];
    originalNotificationCreate = Notification.create;
    originalUserFindById = UserModel.findById;
    originalEmployeeFindById = Employee.findById;
    originalEmployeeFindOne = Employee.findOne;
    originalTransporterSendMail = transporter.sendMail;

    // Stub Notification.create to return the document in memory
    Notification.create = async (doc) => ({ _id: "notif_mock_123", ...doc });

    // Stub UserModel.findById to return mockUser
    UserModel.findById = (id) => ({
      populate: async () => (String(id) === String(mockUser._id) ? mockUser : null),
      select: async () => (String(id) === String(mockUser._id) ? mockUser : null),
      then: (resolve) => resolve(String(id) === String(mockUser._id) ? mockUser : null),
    });

    // Stub Employee.findOne
    Employee.findOne = async () => mockEmployee;

    // Stub Employee.findById
    Employee.findById = (id) => ({
      populate: () => ({
        populate: async () => (String(id) === String(mockEmployee._id) ? mockEmployee : null),
      }),
      then: (resolve) => resolve(String(id) === String(mockEmployee._id) ? mockEmployee : null),
    });

    // Mock transporter.sendMail to capture sent emails
    transporter.sendMail = async (options) => {
      sentEmails.push(options);
      return { messageId: "mock-msg-123" };
    };
  });

  afterEach(() => {
    Notification.create = originalNotificationCreate;
    UserModel.findById = originalUserFindById;
    Employee.findById = originalEmployeeFindById;
    Employee.findOne = originalEmployeeFindOne;
    transporter.sendMail = originalTransporterSendMail;
  });

  test("1. Document verification triggers in-app notification AND sends email to employee", async () => {
    const notif = await sendDocumentVerificationNotification({
      recipient: mockUser._id,
      category: "PAN Card",
      decision: "Verified",
      fileName: "pan_card.pdf",
    });

    assert.ok(notif, "Notification record should be returned");
    assert.strictEqual(notif.type, "document_verified");
    assert.match(notif.message, /verified/i);

    assert.strictEqual(sentEmails.length, 1, "Should send exactly 1 email");
    assert.strictEqual(sentEmails[0].to, "aarav.sharma@example.com");
    assert.strictEqual(sentEmails[0].subject, "HRMS Update: Document Verified");
    assert.match(sentEmails[0].html, /Your PAN Card document \(pan_card\.pdf\) has been verified\./i);
    assert.match(sentEmails[0].html, /Infinetra Innovations/i);
    assert.match(sentEmails[0].html, /Please do not reply to this email/i);
  });

  test("2. Onboarding and Offboarding status updates send emails to employee", async () => {
    // Test Onboarding
    await createNotification({
      recipient: mockUser._id,
      type: "onboarding_updated",
      message: "Your onboarding checklist task 'Submit Bank Details' has been completed.",
      link: "/employee/onboarding",
    });

    assert.strictEqual(sentEmails.length, 1);
    assert.strictEqual(sentEmails[0].to, "aarav.sharma@example.com");
    assert.strictEqual(sentEmails[0].subject, "HRMS Update: Onboarding Process Update");
    assert.match(sentEmails[0].html, /Submit Bank Details/i);
    assert.match(sentEmails[0].html, /View in Portal/i);

    // Test Offboarding
    await createNotification({
      recipient: mockUser._id,
      type: "offboarding_updated",
      message: "Your exit offboarding and clearance process has been initiated.",
      link: "/employee/offboarding",
    });

    assert.strictEqual(sentEmails.length, 2);
    assert.strictEqual(sentEmails[1].to, "aarav.sharma@example.com");
    assert.strictEqual(sentEmails[1].subject, "HRMS Update: Offboarding Status Update");
    assert.match(sentEmails[1].html, /exit offboarding and clearance process has been initiated/i);
  });

  test("3. Shift assignment triggers an email per assigned employee", async () => {
    const user2 = {
      _id: "user_emp_2",
      name: "Rohit Verma",
      email: "rohit.verma@example.com",
      organizationId: mockOrg,
    };
    const emp2 = {
      _id: "emp_2",
      employment_status: "Active",
      user_id: user2,
    };

    UserModel.findById = (id) => ({
      populate: async () => (String(id) === String(user2._id) ? user2 : mockUser),
      select: async () => (String(id) === String(user2._id) ? user2 : mockUser),
      then: (resolve) => resolve(String(id) === String(user2._id) ? user2 : mockUser),
    });

    await notifyShiftAssignment({
      employees: [mockEmployee, emp2],
      shift: { name: "Morning General Shift", start_time: "09:00", end_time: "18:00" },
    });

    assert.strictEqual(sentEmails.length, 2, "Both assigned employees must receive an email");
    assert.strictEqual(sentEmails[0].to, "aarav.sharma@example.com");
    assert.strictEqual(sentEmails[1].to, "rohit.verma@example.com");
    assert.strictEqual(sentEmails[0].subject, "HRMS Update: Shift Assignment Update");
    assert.match(sentEmails[0].html, /Morning General Shift/i);
  });

  test("4. Work From Home (WFH) decision triggers email to employee", async () => {
    await notifyWFHDecision({
      employee: mockEmployee,
      startDate: new Date("2026-10-01"),
      endDate: new Date("2026-10-03"),
      decision: "Approved",
    });

    assert.strictEqual(sentEmails.length, 1);
    assert.strictEqual(sentEmails[0].to, "aarav.sharma@example.com");
    assert.strictEqual(sentEmails[0].subject, "HRMS Update: Work From Home Request Approved");
    assert.match(sentEmails[0].html, /has been approved/i);
  });

  test("5. SMTP failure does NOT throw or prevent notification creation", async () => {
    // Simulate SMTP network failure (e.g. ECONNREFUSED)
    transporter.sendMail = async () => {
      throw new Error("connect ECONNREFUSED 127.0.0.1:587");
    };

    const notif = await createNotification({
      recipient: mockUser._id,
      type: "asset_assigned",
      message: "A new company asset has been assigned to you: Dell Latitude 5430.",
      link: "/employee/profile",
    });

    // In-app notification must succeed completely despite email failure
    assert.ok(notif, "Notification document must be returned successfully");
    assert.strictEqual(notif.type, "asset_assigned");
    assert.match(notif.message, /Dell Latitude 5430/i);
  });

  test("6. skipEmail flag suppresses email dispatch when rich email is already handled", async () => {
    const notif = await createNotification({
      recipient: mockUser._id,
      type: "bonus",
      message: "Annual bonus credited",
      skipEmail: true,
    });

    assert.ok(notif);
    assert.strictEqual(sentEmails.length, 0, "Email must not be sent when skipEmail: true");
  });

  test("7. Fallback resolution: resolves employee email via Employee.findById if employee ID passed", async () => {
    // When recipient is emp_1 (Employee ID instead of User ID)
    UserModel.findById = () => ({
      populate: async () => null,
      select: async () => null,
      then: (resolve) => resolve(null),
    });

    await createNotification({
      recipient: mockEmployee._id,
      type: "payroll",
      message: "Provident Fund settlement processed successfully.",
    });

    assert.strictEqual(sentEmails.length, 1);
    assert.strictEqual(sentEmails[0].to, "aarav.sharma@example.com");
    assert.strictEqual(sentEmails[0].subject, "HRMS Update: Payroll & Compensation Update");
  });
});
