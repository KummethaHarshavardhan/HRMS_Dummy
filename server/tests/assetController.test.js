import { describe, test } from "node:test";
import assert from "node:assert";
import {
  ASSET_TYPES,
  ASSET_STATUSES,
  ASSET_CONDITIONS,
} from "../models/Asset.js";
import {
  validateCreateAsset,
  validateAssignAsset,
  validateReturnAsset,
} from "../validations/assetValidation.js";

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

// Pure business logic simulating assignment & return state transitions
const attemptAssignAsset = (asset, employeeId) => {
  if (asset.status !== "Available") {
    throw new Error(`Asset is not available for assignment. Current status: ${asset.status}`);
  }
  return {
    assignedAsset: {
      ...asset,
      status: "Assigned",
      current_assignment: "assignment-123",
    },
    assignmentRecord: {
      asset_id: asset._id,
      employee_id: employeeId,
      assigned_date: new Date(),
      status: "Active",
    },
  };
};

const attemptReturnAsset = (assignment, returnCondition, returnNotes) => {
  if (assignment.status !== "Active") {
    throw new Error("No active assignment found for this asset.");
  }
  const updatedAssignment = {
    ...assignment,
    status: "Returned",
    returned_date: new Date(),
    return_condition: returnCondition || "Good",
    notes: returnNotes || assignment.notes,
  };
  const updatedAsset = {
    status: "Available",
    current_assignment: null,
    condition: returnCondition || "Good",
  };
  return { updatedAssignment, updatedAsset };
};

describe("Asset Management Module - Business Logic & Validations", () => {
  describe("Asset Enums Coverage", () => {
    test("contains standard asset types", () => {
      const expectedTypes = ["Laptop", "Desktop", "Monitor", "ID Card", "Mobile", "SIM", "Access Card", "Other"];
      for (const t of expectedTypes) {
        assert.ok(ASSET_TYPES.includes(t), `Missing asset type: ${t}`);
      }
    });

    test("contains asset statuses", () => {
      assert.deepStrictEqual(ASSET_STATUSES, [
        "Available",
        "Assigned",
        "Under Repair",
        "Retired",
      ]);
    });

    test("contains asset condition options", () => {
      assert.deepStrictEqual(ASSET_CONDITIONS, [
        "New",
        "Good",
        "Fair",
        "Damaged",
      ]);
    });
  });

  describe("Assignment Rules: Only Available Assets Can Be Assigned", () => {
    test("successfully assigns asset when status is Available", () => {
      const availableAsset = {
        _id: "ast-001",
        asset_tag: "AST-LAP-001",
        status: "Available",
        condition: "Good",
      };

      const { assignedAsset, assignmentRecord } = attemptAssignAsset(
        availableAsset,
        "emp-001"
      );

      assert.strictEqual(assignedAsset.status, "Assigned");
      assert.strictEqual(assignedAsset.current_assignment, "assignment-123");
      assert.strictEqual(assignmentRecord.status, "Active");
      assert.strictEqual(assignmentRecord.employee_id, "emp-001");
      assert.ok(assignmentRecord.assigned_date instanceof Date);
    });

    test("blocks assignment when asset status is 'Assigned'", () => {
      const occupiedAsset = {
        _id: "ast-002",
        status: "Assigned",
      };

      assert.throws(
        () => attemptAssignAsset(occupiedAsset, "emp-002"),
        /Asset is not available for assignment. Current status: Assigned/
      );
    });

    test("blocks assignment when asset is 'Under Repair' or 'Retired'", () => {
      const maintenanceAsset = { _id: "ast-003", status: "Under Repair" };
      const retiredAsset = { _id: "ast-004", status: "Retired" };

      assert.throws(
        () => attemptAssignAsset(maintenanceAsset, "emp-003"),
        /Asset is not available for assignment/
      );
      assert.throws(
        () => attemptAssignAsset(retiredAsset, "emp-004"),
        /Asset is not available for assignment/
      );
    });
  });

  describe("Return Workflow: Resets Status to Available & Records History", () => {
    test("sets asset status back to 'Available' upon return", () => {
      const activeAssignment = {
        _id: "asgn-100",
        asset_id: "ast-001",
        employee_id: "emp-001",
        status: "Active",
        notes: "Initial allocation",
      };

      const { updatedAssignment, updatedAsset } = attemptReturnAsset(
        activeAssignment,
        "Good",
        "Returned in normal condition"
      );

      assert.strictEqual(updatedAsset.status, "Available");
      assert.strictEqual(updatedAsset.current_assignment, null);
      assert.strictEqual(updatedAsset.condition, "Good");

      assert.strictEqual(updatedAssignment.status, "Returned");
      assert.strictEqual(updatedAssignment.return_condition, "Good");
      assert.ok(updatedAssignment.returned_date instanceof Date);
      assert.strictEqual(updatedAssignment.notes, "Returned in normal condition");
    });

    test("updates asset condition to Damaged if returned in damaged condition", () => {
      const activeAssignment = {
        _id: "asgn-101",
        status: "Active",
      };

      const { updatedAsset, updatedAssignment } = attemptReturnAsset(
        activeAssignment,
        "Damaged",
        "Screen cracked"
      );

      assert.strictEqual(updatedAsset.status, "Available");
      assert.strictEqual(updatedAsset.condition, "Damaged");
      assert.strictEqual(updatedAssignment.return_condition, "Damaged");
    });

    test("rejects return if assignment is already closed/returned", () => {
      const closedAssignment = {
        _id: "asgn-102",
        status: "Returned",
      };

      assert.throws(
        () => attemptReturnAsset(closedAssignment, "Good"),
        /No active assignment found/
      );
    });
  });

  describe("Asset Validations Middleware", () => {
    test("rejects asset creation when asset_tag is missing", () => {
      const { req, res, next, wasNextCalled } = createMockReqRes({
        type: "Laptop",
        brand: "Dell",
        model: "Latitude 5520",
      });
      validateCreateAsset(req, res, next);

      assert.strictEqual(wasNextCalled(), false);
      assert.strictEqual(res.statusCode, 400);
      assert.match(res.data.message, /asset_tag is required/);
    });

    test("rejects asset creation when brand or model is missing", () => {
      const { req, res, next, wasNextCalled } = createMockReqRes({
        asset_tag: "AST001",
        type: "Laptop",
        brand: "",
        model: "Latitude",
      });
      validateCreateAsset(req, res, next);

      assert.strictEqual(wasNextCalled(), false);
      assert.strictEqual(res.statusCode, 400);
      assert.match(res.data.message, /brand is required/);
    });

    test("rejects asset assignment when employee_id is missing", () => {
      const { req, res, next, wasNextCalled } = createMockReqRes({
        asset_id: "ast-001",
      });
      validateAssignAsset(req, res, next);

      assert.strictEqual(wasNextCalled(), false);
      assert.strictEqual(res.statusCode, 400);
      assert.match(res.data.message, /employee_id is required/);
    });

    test("rejects asset return when neither assignment_id nor asset_id provided", () => {
      const { req, res, next, wasNextCalled } = createMockReqRes({});
      validateReturnAsset(req, res, next);

      assert.strictEqual(wasNextCalled(), false);
      assert.strictEqual(res.statusCode, 400);
      assert.match(res.data.message, /Either assignment_id or asset_id is required/);
    });

    test("passes valid create, assign, and return payloads", () => {
      const createRes = createMockReqRes({
        asset_tag: "AST009",
        type: "Monitor",
        brand: "Dell",
        model: "U2723QE",
        status: "Available",
        condition: "New",
      });
      validateCreateAsset(createRes.req, createRes.res, createRes.next);
      assert.strictEqual(createRes.wasNextCalled(), true);

      const assignRes = createMockReqRes({
        asset_id: "ast-009",
        employee_id: "emp-101",
      });
      validateAssignAsset(assignRes.req, assignRes.res, assignRes.next);
      assert.strictEqual(assignRes.wasNextCalled(), true);

      const returnRes = createMockReqRes({
        assignment_id: "asgn-009",
        return_condition: "Good",
      });
      validateReturnAsset(returnRes.req, returnRes.res, returnRes.next);
      assert.strictEqual(returnRes.wasNextCalled(), true);
    });
  });
});
