import mongoose from "mongoose";
import { ASSET_CONDITIONS } from "./Asset.js";

const assetAssignmentSchema = new mongoose.Schema(
  {
    asset_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Asset",
      required: [true, "Asset ID is required"],
      index: true,
    },

    employee_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: [true, "Employee ID is required"],
      index: true,
    },

    assigned_date: {
      type: Date,
      default: Date.now,
    },

    returned_date: {
      type: Date,
      default: null,
    },

    assigned_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employees",
      default: null,
    },

    return_condition: {
      type: String,
      enum: ASSET_CONDITIONS,
      default: null,
    },

    notes: {
      type: String,
      default: "",
      trim: true,
    },

    status: {
      type: String,
      enum: ["Active", "Returned"],
      default: "Active",
      index: true,
    },

    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "asset_assignments",
  }
);

const AssetAssignment = mongoose.model(
  "AssetAssignment",
  assetAssignmentSchema
);

export default AssetAssignment;
