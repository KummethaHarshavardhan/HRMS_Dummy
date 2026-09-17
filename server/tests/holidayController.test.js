import { describe, test } from "node:test";
import assert from "node:assert";
import { HOLIDAY_TYPES } from "../models/Holiday.js";
import {
  validateCreateHoliday,
  validateBulkHoliday,
} from "../validations/holidayValidation.js";

const createMockReqRes = (body = {}, query = {}) => {
  const req = { body, query };
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

// Filter logic function matching controller implementation
const filterHolidays = (holidays, { year, month, type }) => {
  return holidays.filter((h) => {
    const d = new Date(h.date);
    if (year && h.year !== parseInt(year, 10)) return false;
    if (month !== undefined && month !== null && month !== "") {
      if (d.getMonth() !== parseInt(month, 10)) return false;
    }
    if (type && type !== "ALL" && h.type !== type) return false;
    return true;
  });
};

describe("Holiday Calendar Module - Business Logic & Validations", () => {
  describe("Holiday Types & Validation", () => {
    test("contains standard required holiday types", () => {
      assert.deepStrictEqual(HOLIDAY_TYPES, [
        "National",
        "Regional",
        "Optional",
        "Restricted",
      ]);
    });

    test("rejects creation when name is missing or whitespace only", () => {
      const { req, res, next, wasNextCalled } = createMockReqRes({
        name: "   ",
        date: "2026-08-15",
      });
      validateCreateHoliday(req, res, next);
      assert.strictEqual(wasNextCalled(), false);
      assert.strictEqual(res.statusCode, 400);
      assert.match(res.data.message, /Holiday name is required/);
    });

    test("rejects creation when date is missing or invalid", () => {
      const { req, res, next, wasNextCalled } = createMockReqRes({
        name: "Independence Day",
        date: "invalid-date-string",
      });
      validateCreateHoliday(req, res, next);
      assert.strictEqual(wasNextCalled(), false);
      assert.strictEqual(res.statusCode, 400);
      assert.match(res.data.message, /Invalid date format/);
    });

    test("rejects creation with an unsupported holiday type", () => {
      const { req, res, next, wasNextCalled } = createMockReqRes({
        name: "Some Holiday",
        date: "2026-10-02",
        type: "ForeignHoliday",
      });
      validateCreateHoliday(req, res, next);
      assert.strictEqual(wasNextCalled(), false);
      assert.strictEqual(res.statusCode, 400);
      assert.match(res.data.message, /Holiday type must be one of/);
    });

    test("accepts valid Optional holiday payload", () => {
      const { req, res, next, wasNextCalled } = createMockReqRes({
        name: "Maha Shivaratri",
        date: "2026-03-08",
        type: "Optional",
        description: "Restricted floating holiday",
      });
      validateCreateHoliday(req, res, next);
      assert.strictEqual(wasNextCalled(), true);
    });
  });

  describe("Duplicate Holiday Detection", () => {
    test("detects duplicate holiday on the same date and name", () => {
      const existingHolidays = [
        { name: "New Year's Day", date: "2026-01-01" },
        { name: "Republic Day", date: "2026-01-26" },
      ];

      const checkDuplicate = (newHoliday) => {
        return existingHolidays.some(
          (h) =>
            h.name.toLowerCase() === newHoliday.name.trim().toLowerCase() &&
            new Date(h.date).toDateString() === new Date(newHoliday.date).toDateString()
        );
      };

      assert.strictEqual(
        checkDuplicate({ name: "Republic Day", date: "2026-01-26" }),
        true
      );
      assert.strictEqual(
        checkDuplicate({ name: "Holi", date: "2026-03-25" }),
        false
      );
    });
  });

  describe("Year & Month Holiday Filtering Logic", () => {
    const mockHolidays = [
      { name: "New Year", date: "2026-01-01", year: 2026, type: "National" },
      { name: "Republic Day", date: "2026-01-26", year: 2026, type: "National" },
      { name: "Holi", date: "2026-03-25", year: 2026, type: "Optional" },
      { name: "Independence Day", date: "2026-08-15", year: 2026, type: "National" },
      { name: "Prior Year Day", date: "2025-12-25", year: 2025, type: "National" },
      { name: "Future Year Day", date: "2027-01-01", year: 2027, type: "Company" },
    ];

    test("filters holidays strictly by selected year", () => {
      const results2026 = filterHolidays(mockHolidays, { year: "2026" });
      assert.strictEqual(results2026.length, 4);
      results2026.forEach((h) => assert.strictEqual(h.year, 2026));

      const results2025 = filterHolidays(mockHolidays, { year: "2025" });
      assert.strictEqual(results2025.length, 1);
      assert.strictEqual(results2025[0].name, "Prior Year Day");
    });

    test("filters holidays by specific month index (0 = January)", () => {
      const janHolidays = filterHolidays(mockHolidays, { year: "2026", month: "0" });
      assert.strictEqual(janHolidays.length, 2);
      assert.ok(janHolidays.some((h) => h.name === "New Year"));
      assert.ok(janHolidays.some((h) => h.name === "Republic Day"));
    });

    test("filters holidays by type", () => {
      const optionalHolidays = filterHolidays(mockHolidays, { year: "2026", type: "Optional" });
      assert.strictEqual(optionalHolidays.length, 1);
      assert.strictEqual(optionalHolidays[0].name, "Holi");
    });
  });

  describe("Bulk Import Holidays Validation Middleware", () => {
    test("rejects bulk payload if not an array or empty array", () => {
      const { req, res, next, wasNextCalled } = createMockReqRes({ holidays: [] });
      validateBulkHoliday(req, res, next);
      assert.strictEqual(wasNextCalled(), false);
      assert.strictEqual(res.statusCode, 400);
      assert.match(res.data.message, /must be a non-empty array/);
    });

    test("rejects bulk payload if any item is missing required name or date", () => {
      const { req, res, next, wasNextCalled } = createMockReqRes({
        holidays: [
          { name: "Valid Holiday", date: "2026-05-01" },
          { name: "", date: "2026-05-02" }, // missing name
        ],
      });
      validateBulkHoliday(req, res, next);
      assert.strictEqual(wasNextCalled(), false);
      assert.strictEqual(res.statusCode, 400);
      assert.match(res.data.message, /missing required 'name' or 'date'/);
    });

    test("passes bulk payload with valid items", () => {
      const { req, res, next, wasNextCalled } = createMockReqRes({
        holidays: [
          { name: "Holiday 1", date: "2026-05-01", type: "National" },
          { name: "Holiday 2", date: "2026-06-01", type: "Optional" },
        ],
      });
      validateBulkHoliday(req, res, next);
      assert.strictEqual(wasNextCalled(), true);
    });
  });
});
