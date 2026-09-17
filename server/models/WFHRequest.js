import mongoose from "mongoose";

const attachedFileSchema = new mongoose.Schema(
  {
    file_name: {
      type: String,
      required: true,
      trim: true,
    },
    stored_filename: {
      type: String,
      required: true,
    },
    file_url: {
      type: String,
      default: "",
    },
    mime_type: {
      type: String,
      default: "application/octet-stream",
    },
    file_size: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const wfhRequestSchema = new mongoose.Schema(
  {
    employee_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    start_date: {
      type: Date,
      required: true,
    },
    end_date: {
      type: Date,
      required: true,
    },
    attached_files: [attachedFileSchema],
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Withdrawn"],
      default: "Pending",
    },
    withdrawn_at: {
      type: Date,
      default: null,
    },
    decided_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employees",
      default: null,
    },
    decided_at: {
      type: Date,
      default: null,
    },
    rejection_reason: {
      type: String,
      default: null,
      trim: true,
    },
    requested_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

wfhRequestSchema.index({ organizationId: 1, status: 1 });
wfhRequestSchema.index({ employee_id: 1, createdAt: -1 });

const WFHRequest = mongoose.model("WFHRequest", wfhRequestSchema);

export default WFHRequest;
