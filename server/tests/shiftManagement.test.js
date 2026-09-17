import { describe, test } from "node:test";
import assert from "node:assert";
import Shift from "../models/Shift.js";
import ShiftGroup from "../models/ShiftGroup.js";
import Employee from "../models/Employee.js";
import Notification from "../models/Notification.js";
import {
  getAllShifts,
  createShift,
  updateShift,
  deleteShift,
  getMyShift,
  getAllShiftGroups,
  createShiftGroup,
  updateShiftGroup,
  assignShiftToGroup,
  removeEmployeeFromGroup,
  deleteShiftGroup,
} from "../controllers/shiftController.js";
import {
  validateCreateShift,
  validateUpdateShift,
  validateCreateShiftGroup,
} from "../validations/shiftValidation.js";

// Helper to mock express req and res
const createMockReqRes = (params = {}, query = {}, user = {}, body = {}) => {
  let statusCode = 200;
  let responseData = null;

  const res = {
    statusCode: 200,
    headers: {},
    headersSent: false,
    status(code) {
      this.statusCode = code;
      statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      responseData = payload;
      this.headersSent = true;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
  };

  const req = {
    params,
    query,
    user,
    headers: {},
    body,
  };

  return {
    req,
    res,
    getStatusCode: () => statusCode,
    getData: () => responseData,
  };
};

describe("Shift & Roster Management Module - Unit Tests", () => {
  const orgA = "607f1f77bcf86cd799439011";
  const orgB = "607f1f77bcf86cd799439022";

  const mockHrUserOrgA = {
    id: "607f1f77bcf86cd799439100",
    role: "hr_manager",
    organizationId: orgA,
    name: "Priya HR",
  };

  const mockAdminUserOrgA = {
    id: "607f1f77bcf86cd799439101",
    role: "admin",
    organizationId: orgA,
    name: "Amit Admin",
  };

  const mockHrUserOrgB = {
    id: "607f1f77bcf86cd799439200",
    role: "hr_manager",
    organizationId: orgB,
    name: "Sunil HR OrgB",
  };

  const mockSuperAdmin = {
    id: "607f1f77bcf86cd799439999",
    role: "super_admin",
    name: "Root SuperAdmin",
  };

  const mockEmployeeUser1 = {
    id: "607f1f77bcf86cd799439301",
    role: "employee",
    organizationId: orgA,
    name: "Kakarla Vijay",
  };

  const mockShiftNight = {
    _id: "607f1f77bcf86cd799439401",
    name: "Night Shift",
    start_time: "22:00",
    end_time: "06:00",
    organizationId: orgA,
    color: "#4f46e5",
    is_active: true,
    save: async () => {},
    toObject: function () {
      return { ...this };
    },
  };

  const mockShiftMorning = {
    _id: "607f1f77bcf86cd799439402",
    name: "Morning Shift",
    start_time: "06:00",
    end_time: "14:00",
    organizationId: orgA,
    color: "#059669",
    is_active: true,
    save: async () => {},
    toObject: function () {
      return { ...this };
    },
  };

  // =========================================================================
  // 1. Overnight Shift & Input Validations
  // =========================================================================
  describe("1. Shift Validation Middleware", () => {
    test("accepts overnight shift (start_time: 22:00, end_time: 06:00)", () => {
      let nextCalled = false;
      const { req, res } = createMockReqRes(
        {},
        {},
        {},
        {
          name: "Overnight Shift",
          start_time: "22:00",
          end_time: "06:00",
          color: "#4f46e5",
        }
      );

      validateCreateShift(req, res, () => {
        nextCalled = true;
      });

      assert.strictEqual(nextCalled, true, "Middleware should call next() for valid overnight shift");
      assert.strictEqual(res.statusCode, 200);
    });

    test("rejects identical start_time and end_time (0-duration shift)", () => {
      let nextCalled = false;
      const { req, res } = createMockReqRes(
        {},
        {},
        {},
        {
          name: "Zero Duration Shift",
          start_time: "09:00",
          end_time: "09:00",
        }
      );

      validateCreateShift(req, res, () => {
        nextCalled = true;
      });

      assert.strictEqual(nextCalled, false);
      assert.strictEqual(res.statusCode, 400);
      assert.match(res.data.message, /cannot be identical/);
    });

    test("rejects invalid 24-hour time format", () => {
      let nextCalled = false;
      const { req, res } = createMockReqRes(
        {},
        {},
        {},
        {
          name: "Invalid Time Shift",
          start_time: "25:00",
          end_time: "09:00",
        }
      );

      validateCreateShift(req, res, () => {
        nextCalled = true;
      });

      assert.strictEqual(nextCalled, false);
      assert.strictEqual(res.statusCode, 400);
      assert.match(res.data.message, /HH:mm 24-hour format/);
    });
  });

  // =========================================================================
  // 2. Shift Creation & Duplicate Checks
  // =========================================================================
  describe("2. Shift Creation & Duplicate Prevention", () => {
    test("creates shift scoped to organizationId", async () => {
      const origFindOne = Shift.findOne;
      const origCreate = Shift.create;

      try {
        Shift.findOne = async () => null; // No duplicate
        Shift.create = async (payload) => ({
          _id: "607f1f77bcf86cd799439403",
          ...payload,
        });

        const { req, res } = createMockReqRes(
          {},
          {},
          mockHrUserOrgA,
          {
            name: "Afternoon Shift",
            start_time: "14:00",
            end_time: "22:00",
            color: "#d97706",
          }
        );

        await createShift(req, res);

        assert.strictEqual(res.statusCode, 201);
        assert.strictEqual(res.data.success, true);
        assert.strictEqual(res.data.data.organizationId, orgA);
        assert.strictEqual(res.data.data.name, "Afternoon Shift");
      } finally {
        Shift.findOne = origFindOne;
        Shift.create = origCreate;
      }
    });

    test("rejects creating duplicate shift name in same organization", async () => {
      const origFindOne = Shift.findOne;

      try {
        Shift.findOne = async () => mockShiftNight;

        const { req, res } = createMockReqRes(
          {},
          {},
          mockHrUserOrgA,
          {
            name: "Night Shift",
            start_time: "22:00",
            end_time: "06:00",
          }
        );

        await createShift(req, res);

        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(res.data.success, false);
        assert.match(res.data.message, /already exists/);
      } finally {
        Shift.findOne = origFindOne;
      }
    });
  });

  // =========================================================================
  // 3. Shift Group Creation & Cascade Member Update
  // =========================================================================
  describe("3. Shift Group Creation & Member Synchronization", () => {
    test("creating a shift group with employees sets current_shift_id and current_shift_group_id on members and notifies them", async () => {
      const origShiftFindOne = Shift.findOne;
      const origGroupFindOne = ShiftGroup.findOne;
      const origGroupCreate = ShiftGroup.create;
      const origGroupFindById = ShiftGroup.findById;
      const origEmpFind = Employee.find;
      const origEmpUpdateMany = Employee.updateMany;
      const origNotifCreate = Notification.create;

      const empId1 = "607f1f77bcf86cd799439501";
      const empId2 = "607f1f77bcf86cd799439502";
      const createdGroupId = "607f1f77bcf86cd799439601";

      let updatedEmpFilter = null;
      let updatedEmpFields = null;
      const createdNotifs = [];

      try {
        Shift.findOne = async () => mockShiftNight;
        ShiftGroup.findOne = async () => null;

        const mockEmployees = [
          {
            _id: empId1,
            user_id: { _id: "607f1f77bcf86cd799439301", name: "Vijay K" },
            employment_status: "Active",
          },
          {
            _id: empId2,
            user_id: { _id: "607f1f77bcf86cd799439302", name: "Rohan V" },
            employment_status: "Active",
          },
        ];

        Employee.find = () => ({
          populate: async () => mockEmployees,
        });

        ShiftGroup.create = async (payload) => ({
          _id: createdGroupId,
          ...payload,
        });

        ShiftGroup.findById = () => ({
          populate: () => ({
            populate: async () => ({
              _id: createdGroupId,
              name: "Operations Team Alpha",
              shift_id: mockShiftNight,
              employee_ids: mockEmployees,
            }),
          }),
        });

        Employee.updateMany = async (filter, update) => {
          updatedEmpFilter = filter;
          updatedEmpFields = update;
        };

        Notification.create = async (payload) => {
          createdNotifs.push(payload);
          return payload;
        };

        const { req, res } = createMockReqRes(
          {},
          {},
          mockHrUserOrgA,
          {
            name: "Operations Team Alpha",
            shift_id: mockShiftNight._id,
            employee_ids: [empId1, empId2],
          }
        );

        await createShiftGroup(req, res);

        assert.strictEqual(res.statusCode, 201);
        assert.strictEqual(res.data.success, true);

        // Verify cascade update on Employee model
        assert.deepStrictEqual(updatedEmpFilter, { _id: { $in: [empId1, empId2] } });
        assert.strictEqual(updatedEmpFields.current_shift_id, mockShiftNight._id);
        assert.strictEqual(updatedEmpFields.current_shift_group_id, createdGroupId);

        // Verify notifications triggered
        assert.strictEqual(createdNotifs.length, 2);
        assert.strictEqual(createdNotifs[0].type, "shift_assigned");
        assert.match(createdNotifs[0].message, /Your shift has been set to Night Shift/);
      } finally {
        Shift.findOne = origShiftFindOne;
        ShiftGroup.findOne = origGroupFindOne;
        ShiftGroup.create = origGroupCreate;
        ShiftGroup.findById = origGroupFindById;
        Employee.find = origEmpFind;
        Employee.updateMany = origEmpUpdateMany;
        Notification.create = origNotifCreate;
      }
    });
  });

  // =========================================================================
  // 4. Group Shift Reassignment
  // =========================================================================
  describe("4. Reassigning Shift to Group (Bulk Cascade Update)", () => {
    test("reassigning a group's shift updates all members and notifies them", async () => {
      const origGroupFindOne = ShiftGroup.findOne;
      const origShiftFindOne = Shift.findOne;
      const origEmpUpdateMany = Employee.updateMany;
      const origEmpFind = Employee.find;
      const origNotifCreate = Notification.create;

      const empId1 = "607f1f77bcf86cd799439501";
      const empId2 = "607f1f77bcf86cd799439502";
      const groupId = "607f1f77bcf86cd799439601";

      const mockGroup = {
        _id: groupId,
        name: "Support Group A",
        organizationId: orgA,
        shift_id: mockShiftNight._id,
        employee_ids: [empId1, empId2],
        save: async () => {},
      };

      let updatedFields = null;
      const createdNotifs = [];

      try {
        ShiftGroup.findOne = async () => mockGroup;
        Shift.findOne = async () => mockShiftMorning; // Reassigning to Morning Shift

        Employee.updateMany = async (filter, update) => {
          updatedFields = update;
        };

        Employee.find = () => ({
          populate: async () => [
            { _id: empId1, user_id: { _id: "607f1f77bcf86cd799439301" } },
            { _id: empId2, user_id: { _id: "607f1f77bcf86cd799439302" } },
          ],
        });

        Notification.create = async (payload) => {
          createdNotifs.push(payload);
          return payload;
        };

        const { req, res } = createMockReqRes(
          { id: groupId },
          {},
          mockHrUserOrgA,
          { shift_id: mockShiftMorning._id }
        );

        await assignShiftToGroup(req, res);

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.data.success, true);
        assert.strictEqual(res.data.count, 2);

        // Verify group shift updated
        assert.strictEqual(mockGroup.shift_id, mockShiftMorning._id);

        // Verify Employee cascade update
        assert.strictEqual(updatedFields.current_shift_id, mockShiftMorning._id);
        assert.strictEqual(updatedFields.current_shift_group_id, groupId);

        // Verify notifications sent
        assert.strictEqual(createdNotifs.length, 2);
        assert.match(createdNotifs[0].message, /Morning Shift/);
      } finally {
        ShiftGroup.findOne = origGroupFindOne;
        Shift.findOne = origShiftFindOne;
        Employee.updateMany = origEmpUpdateMany;
        Employee.find = origEmpFind;
        Notification.create = origNotifCreate;
      }
    });
  });

  // =========================================================================
  // 5. Shift Deletion Gating & Group Dependency
  // =========================================================================
  describe("5. Shift Deletion Dependency Protection", () => {
    test("blocks deleting a shift if it is still referenced by any ShiftGroup", async () => {
      const origShiftFindOne = Shift.findOne;
      const origGroupFind = ShiftGroup.find;

      try {
        Shift.findOne = async () => mockShiftNight;
        ShiftGroup.find = () => ({
          select: async () => [{ name: "Support Team Alpha" }, { name: "Night Crew" }],
        });

        const { req, res } = createMockReqRes(
          { id: mockShiftNight._id },
          {},
          mockHrUserOrgA
        );

        await deleteShift(req, res);

        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(res.data.success, false);
        assert.match(res.data.message, /Cannot delete shift/);
        assert.match(res.data.message, /Support Team Alpha/);
        assert.match(res.data.message, /Night Crew/);
      } finally {
        Shift.findOne = origShiftFindOne;
        ShiftGroup.find = origGroupFind;
      }
    });

    test("allows deleting an unreferenced shift", async () => {
      const origShiftFindOne = Shift.findOne;
      const origGroupFind = ShiftGroup.find;
      const origDeleteById = Shift.findByIdAndDelete;

      let deletedId = null;

      try {
        Shift.findOne = async () => mockShiftNight;
        ShiftGroup.find = () => ({ select: async () => [] }); // No referencing groups
        Shift.findByIdAndDelete = async (id) => {
          deletedId = id;
        };

        const { req, res } = createMockReqRes(
          { id: mockShiftNight._id },
          {},
          mockHrUserOrgA
        );

        await deleteShift(req, res);

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.data.success, true);
        assert.strictEqual(deletedId, mockShiftNight._id);
      } finally {
        Shift.findOne = origShiftFindOne;
        ShiftGroup.find = origGroupFind;
        Shift.findByIdAndDelete = origDeleteById;
      }
    });
  });

  // =========================================================================
  // 6. Multi-Tenant Scoping & Access Control
  // =========================================================================
  describe("6. Multi-Tenant Scoping & SuperAdmin Exclusion", () => {
    test("rejects super_admin from managing organization shifts with 403", async () => {
      const { req, res } = createMockReqRes({}, {}, mockSuperAdmin);
      await getAllShifts(req, res);

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.data.success, false);
      assert.match(res.data.message, /Super Admin is not authorized/);
    });

    test("prevents HR/Admin from accessing shifts of another organization", async () => {
      const origFind = Shift.find;
      let searchedOrg = null;

      try {
        Shift.find = (query) => {
          searchedOrg = query.organizationId;
          return {
            sort: async () => [],
          };
        };

        const { req, res } = createMockReqRes({}, {}, mockHrUserOrgB);
        await getAllShifts(req, res);

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(searchedOrg, orgB, "Must strictly scope by the user's organizationId");
        assert.notStrictEqual(searchedOrg, orgA);
      } finally {
        Shift.find = origFind;
      }
    });
  });

  // =========================================================================
  // 7. Employee Self-Service (getMyShift)
  // =========================================================================
  describe("7. Employee Self-Service (getMyShift)", () => {
    test("returns only the logged-in employee's own assigned shift and group", async () => {
      const origFindOne = Employee.findOne;

      try {
        Employee.findOne = () => ({
          populate: () => ({
            populate: async () => ({
              _id: "607f1f77bcf86cd799439501",
              user_id: mockEmployeeUser1.id,
              current_shift_id: mockShiftNight,
              current_shift_group_id: { _id: "607f1f77bcf86cd799439601", name: "Night Team" },
            }),
          }),
        });

        const { req, res } = createMockReqRes({}, {}, mockEmployeeUser1);
        await getMyShift(req, res);

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.data.success, true);
        assert.strictEqual(res.data.hasShift, true);
        assert.strictEqual(res.data.shift.name, "Night Shift");
        assert.strictEqual(res.data.group.name, "Night Team");
      } finally {
        Employee.findOne = origFindOne;
      }
    });

    test("handles employee with no shift assigned cleanly", async () => {
      const origFindOne = Employee.findOne;

      try {
        Employee.findOne = () => ({
          populate: () => ({
            populate: async () => ({
              _id: "607f1f77bcf86cd799439501",
              user_id: mockEmployeeUser1.id,
              current_shift_id: null,
              current_shift_group_id: null,
            }),
          }),
        });

        const { req, res } = createMockReqRes({}, {}, mockEmployeeUser1);
        await getMyShift(req, res);

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.data.success, true);
        assert.strictEqual(res.data.hasShift, false);
        assert.strictEqual(res.data.shift, null);
      } finally {
        Employee.findOne = origFindOne;
      }
    });
  });

  // =========================================================================
  // 8. Removing Member from Shift Group
  // =========================================================================
  describe("8. Member Removal from Shift Group", () => {
    test("removing employee from group clears current_shift_id and triggers removal notification", async () => {
      const origGroupFindOne = ShiftGroup.findOne;
      const origShiftFindById = Shift.findById;
      const origEmpFindOneAndUpdate = Employee.findOneAndUpdate;
      const origEmpFind = Employee.find;
      const origNotifCreate = Notification.create;

      const empId = "607f1f77bcf86cd799439501";
      const groupId = "607f1f77bcf86cd799439601";

      const mockGroup = {
        _id: groupId,
        name: "Day Operations",
        shift_id: mockShiftMorning._id,
        employee_ids: [empId, "607f1f77bcf86cd799439502"],
        save: async () => {},
      };

      let clearedFilter = null;
      let clearedUpdate = null;
      let removalNotif = null;

      try {
        ShiftGroup.findOne = async () => mockGroup;
        Shift.findById = async () => mockShiftMorning;

        Employee.find = () => ({
          populate: async () => [
            {
              _id: empId,
              user_id: { _id: "607f1f77bcf86cd799439301", name: "Vijay K" },
            },
          ],
        });

        Employee.findOneAndUpdate = async (filter, update) => {
          clearedFilter = filter;
          clearedUpdate = update;
          return {};
        };

        Notification.create = async (payload) => {
          removalNotif = payload;
          return payload;
        };

        const { req, res } = createMockReqRes(
          { id: groupId, employeeId: empId },
          {},
          mockHrUserOrgA
        );

        await removeEmployeeFromGroup(req, res);

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.data.success, true);
        assert.strictEqual(mockGroup.employee_ids.length, 1);

        // Verify employee fields cleared
        assert.deepStrictEqual(clearedFilter, { _id: empId, current_shift_group_id: groupId });
        assert.deepStrictEqual(clearedUpdate, { current_shift_id: null, current_shift_group_id: null });

        // Verify removal notification
        assert.ok(removalNotif);
        assert.match(removalNotif.message, /You have been removed from Morning Shift/);
      } finally {
        ShiftGroup.findOne = origGroupFindOne;
        Shift.findById = origShiftFindById;
        Employee.findOneAndUpdate = origEmpFindOneAndUpdate;
        Employee.find = origEmpFind;
        Notification.create = origNotifCreate;
      }
    });
  });
});
