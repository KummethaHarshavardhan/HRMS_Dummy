import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import Shift from "../models/Shift.js";
import Organization from "../models/Organization.js";

const DEFAULT_SHIFTS_TEMPLATE = [
  {
    name: "General Shift",
    start_time: "09:00",
    end_time: "18:00",
    color: "#4f46e5",
    is_active: true,
  },
  {
    name: "Morning Shift",
    start_time: "06:00",
    end_time: "14:30",
    color: "#059669",
    is_active: true,
  },
  {
    name: "Evening Shift",
    start_time: "14:00",
    end_time: "22:30",
    color: "#d97706",
    is_active: true,
  },
  {
    name: "Night Shift",
    start_time: "22:00",
    end_time: "06:30",
    color: "#9333ea",
    is_active: true,
  },
];

export async function seedShiftsForOrganization(organizationId) {
  const existingCount = await Shift.countDocuments({ organizationId });
  if (existingCount > 0) {
    return { seeded: false, count: existingCount };
  }

  const shiftsToCreate = DEFAULT_SHIFTS_TEMPLATE.map((s) => ({
    ...s,
    organizationId,
  }));

  const created = await Shift.insertMany(shiftsToCreate);
  return { seeded: true, count: created.length, shifts: created };
}

async function main() {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log("Connected to MongoDB");

    const organizations = await Organization.find();
    console.log(`Found ${organizations.length} organizations.`);

    for (const org of organizations) {
      const result = await seedShiftsForOrganization(org._id);
      if (result.seeded) {
        console.log(`Seeded ${result.count} shifts for org: ${org.name} (${org._id})`);
      } else {
        console.log(`Org: ${org.name} already has ${result.count} shifts.`);
      }
    }

    console.log("Seeding completed successfully.");
  } catch (err) {
    console.error("Seeding error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && process.argv[1].endsWith("seedDefaultShifts.js")) {
  main();
}
