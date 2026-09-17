import mongoose from "mongoose";

export const ASSET_TYPES = [
  "Laptop",
  "Desktop",
  "Monitor",
  "ID Card",
  "Mobile",
  "SIM",
  "Access Card",
  "Other",
];

export const ASSET_STATUSES = [
  "Available",
  "Assigned",
  "Under Repair",
  "Retired",
];

export const ASSET_CONDITIONS = ["New", "Good", "Fair", "Damaged"];

const assetSchema = new mongoose.Schema(
  {
    asset_tag: {
      type: String,
      required: [true, "Asset tag is required"],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    type: {
      type: String,
      required: [true, "Asset type is required"],
      enum: {
        values: ASSET_TYPES,
        message: "{VALUE} is not a valid asset type",
      },
      index: true,
    },

    brand: {
      type: String,
      required: [true, "Brand is required"],
      trim: true,
    },

    model: {
      type: String,
      required: [true, "Model is required"],
      trim: true,
    },

    serial_number: {
      type: String,
      trim: true,
      default: "",
    },

    purchase_date: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ASSET_STATUSES,
      default: "Available",
      index: true,
    },

    condition: {
      type: String,
      enum: ASSET_CONDITIONS,
      default: "Good",
    },

    notes: {
      type: String,
      default: "",
      trim: true,
    },

    current_assignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AssetAssignment",
      default: null,
    },

    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "assets",
  }
);

const Asset = mongoose.model("Asset", assetSchema);
export default Asset;
