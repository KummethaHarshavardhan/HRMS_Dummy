import mongoose from "mongoose";

const shiftGroupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    shift_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shift",
      required: true,
    },
    employee_ids: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employee",
      },
    ],
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employees",
      default: null,
    },
    assigned_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

shiftGroupSchema.index({ organizationId: 1, name: 1 });

const ShiftGroup = mongoose.model("ShiftGroup", shiftGroupSchema);

export default ShiftGroup;
