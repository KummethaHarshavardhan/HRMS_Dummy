import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employees",
      required: true,
    },

    type: {
      type: String,
      enum: [
        "leave_applied",
        "leave_approved",
        "leave_rejected",
        "leave_cancelled",
        "payroll",
        "bonus",
        "general",
        "task_assigned",
        "task_submitted",
        "task_approved",
        "task_rework",
        "task_reassigned",
        "document_uploaded",
        "document_verified",
        "document_rejected",
        "onboarding_updated",
        "offboarding_updated",
        "asset_assigned",
        "asset_returned",
        "shift_assigned",
        "wfh_requested",
        "wfh_approved",
        "wfh_rejected",
        "wfh_withdrawn",
      ],
      default: "general",
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    read: {
      type: Boolean,
      default: false,
    },

    link: {
      type: String,
      default: "",
    },

    attachmentUrl: {
      type: String,
      default: "",
    },

    relatedLeave: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Leave",
      default: null,
    },

    relatedTask: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      default: null,
    },

    relatedAssignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TaskAssignment",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Notification", NotificationSchema);
