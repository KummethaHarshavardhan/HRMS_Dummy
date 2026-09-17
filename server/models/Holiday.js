import mongoose from "mongoose";

export const HOLIDAY_TYPES = ["National", "Regional", "Optional", "Restricted"];

const holidaySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Holiday name is required"],
      trim: true,
    },

    date: {
      type: Date,
      required: [true, "Holiday date is required"],
      index: true,
    },

    year: {
      type: Number,
      required: true,
      index: true,
      default: function () {
        return this.date ? new Date(this.date).getFullYear() : new Date().getFullYear();
      },
    },

    type: {
      type: String,
      required: [true, "Holiday type is required"],
      enum: {
        values: HOLIDAY_TYPES,
        message: "{VALUE} is not a valid holiday type",
      },
      default: "National",
    },

    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
      index: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employees",
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "holidays",
  }
);

// Compound index to prevent duplicate holiday names on the same date for an organization
holidaySchema.index({ date: 1, name: 1, organizationId: 1 }, { unique: true });

const Holiday = mongoose.model("Holiday", holidaySchema);
export default Holiday;
