import mongoose from "mongoose";

const shiftSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    start_time: {
      type: String,
      required: true,
      trim: true,
      // "HH:mm" 24-hour format
    },
    end_time: {
      type: String,
      required: true,
      trim: true,
      // "HH:mm" 24-hour format (overnight allowed)
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    color: {
      type: String,
      default: "#4f46e5",
      trim: true,
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employees",
      default: null,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

shiftSchema.index({ organizationId: 1, name: 1 });

const Shift = mongoose.model("Shift", shiftSchema);

export default Shift;
