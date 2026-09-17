import { describe, test } from "node:test";
import assert from "node:assert";
import {
  DEFAULT_ONBOARDING_TASKS,
  DEFAULT_OFFBOARDING_TASKS,
} from "../config/checklistTemplates.js";
import {
  validateCreateOnboarding,
  validateUpdateChecklistItem,
} from "../validations/onboardingValidation.js";

// Helper to mock express req, res, next
const createMockReqRes = (body = {}, params = {}) => {
  const req = { body, params };
  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    },
  };
  let calledNext = false;
  const next = () => {
    calledNext = true;
  };
  return { req, res, next, wasNextCalled: () => calledNext };
};

// Pure logic for status resolution
const resolveProcessStatus = (tasks) => {
  const allDone = tasks.every((t) => t.status === "Done");
  return allDone ? "Completed" : "In Progress";
};

describe("Onboarding & Offboarding Module - Business Logic & Templates", () => {
  describe("Default Checklist Templates Initialization", () => {
    test("onboarding template contains tasks covering all 4 key departments: HR, IT, Admin, Finance", () => {
      assert.ok(DEFAULT_ONBOARDING_TASKS.length > 0);

      const departments = new Set(DEFAULT_ONBOARDING_TASKS.map((t) => t.category));
      assert.ok(departments.has("HR"), "Must have HR onboarding tasks");
      assert.ok(departments.has("IT"), "Must have IT onboarding tasks");
      assert.ok(departments.has("Admin"), "Must have Admin onboarding tasks");
      assert.ok(departments.has("Finance"), "Must have Finance onboarding tasks");

      // Verify each task defaults to 'Pending'
      DEFAULT_ONBOARDING_TASKS.forEach((task) => {
        assert.strictEqual(task.status, "Pending");
        assert.ok(task.task_name && task.task_name.trim().length > 0);
      });
    });

    test("offboarding template contains tasks covering all 4 key departments", () => {
      assert.ok(DEFAULT_OFFBOARDING_TASKS.length > 0);

      const departments = new Set(DEFAULT_OFFBOARDING_TASKS.map((t) => t.category));
      assert.ok(departments.has("HR"), "Must have HR offboarding tasks");
      assert.ok(departments.has("IT"), "Must have IT offboarding tasks");
      assert.ok(departments.has("Admin"), "Must have Admin offboarding tasks");
      assert.ok(departments.has("Finance"), "Must have Finance offboarding tasks");

      DEFAULT_OFFBOARDING_TASKS.forEach((task) => {
        assert.strictEqual(task.status, "Pending");
        assert.ok(task.task_name && task.task_name.trim().length > 0);
      });
    });
  });

  describe("Status Transitions: In Progress -> Completed", () => {
    test("remains In Progress when not all checklist tasks are Done", () => {
      const tasks = [
        { task_name: "Task 1", status: "Done" },
        { task_name: "Task 2", status: "In Progress" },
        { task_name: "Task 3", status: "Pending" },
      ];
      assert.strictEqual(resolveProcessStatus(tasks), "In Progress");
    });

    test("transitions to Completed only when 100% of checklist tasks are Done", () => {
      const tasks = [
        { task_name: "Task 1", status: "Done" },
        { task_name: "Task 2", status: "Done" },
        { task_name: "Task 3", status: "Done" },
      ];
      assert.strictEqual(resolveProcessStatus(tasks), "Completed");
    });

    test("reverts to In Progress if any task is unmarked from Done back to In Progress or Pending", () => {
      const tasks = [
        { task_name: "Task 1", status: "Done" },
        { task_name: "Task 2", status: "Done" },
        { task_name: "Task 3", status: "Pending" }, // Reopened
      ];
      assert.strictEqual(resolveProcessStatus(tasks), "In Progress");
    });
  });

  describe("Checklist Task Validation Middleware", () => {
    test("rejects onboarding initiation without employee_id", () => {
      const { req, res, next, wasNextCalled } = createMockReqRes({});
      validateCreateOnboarding(req, res, next);

      assert.strictEqual(wasNextCalled(), false);
      assert.strictEqual(res.statusCode, 400);
      assert.match(res.data.message, /employee_id is required/);
    });

    test("accepts valid task status values: Pending, In Progress, Done", () => {
      for (const validStatus of ["Pending", "In Progress", "Done"]) {
        const { req, res, next, wasNextCalled } = createMockReqRes({ status: validStatus });
        validateUpdateChecklistItem(req, res, next);
        assert.strictEqual(wasNextCalled(), true);
      }
    });

    test("rejects invalid task status values", () => {
      const { req, res, next, wasNextCalled } = createMockReqRes({ status: "Rejected" });
      validateUpdateChecklistItem(req, res, next);

      assert.strictEqual(wasNextCalled(), false);
      assert.strictEqual(res.statusCode, 400);
      assert.match(res.data.message, /Status must be one of: Pending, In Progress, Done/);
    });
  });
});
