import mongoose from "mongoose";

export const DOCUMENT_CATEGORIES = [
  "ID Proof",
  "Educational Certificate",
  "Offer Letter",
  "Relieving Letter",
  "Payslip",
  "Contract",
  "Other",
];

export const DOCUMENT_STATUSES = [
  "Pending Verification",
  "Verified",
  "Rejected",
  "Expired",
  "Archived",
];

const documentSchema = new mongoose.Schema(
  {
    employee_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: [true, "Employee reference is required"],
      index: true,
    },

    category: {
      type: String,
      required: [true, "Document category is required"],
      enum: {
        values: DOCUMENT_CATEGORIES,
        message: "{VALUE} is not a valid document category",
      },
      trim: true,
    },

    file_name: {
      type: String,
      required: [true, "Original file name is required"],
      trim: true,
    },

    stored_filename: {
      type: String,
      required: [true, "Stored file name is required"],
      trim: true,
    },

    file_url: {
      type: String,
      required: [true, "File access URL is required"],
      trim: true,
    },

    mime_type: {
      type: String,
      required: [true, "MIME type is required"],
      trim: true,
    },

    file_size: {
      type: Number,
      default: 0,
      min: 0,
    },

    uploaded_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employees",
      required: true,
    },

    uploader_role: {
      type: String,
      enum: ["employee", "admin", "hr_manager", "super_admin"],
      default: "employee",
      index: true,
    },

    uploaded_at: {
      type: Date,
      default: Date.now,
    },

    expiry_date: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: DOCUMENT_STATUSES,
      default: "Pending Verification",
      index: true,
    },

    verified_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employees",
      default: null,
    },

    verified_at: {
      type: Date,
      default: null,
    },

    rejection_reason: {
      type: String,
      default: null,
      trim: true,
      validate: {
        validator: function (v) {
          if (this.status === "Rejected") {
            return typeof v === "string" && v.trim().length > 0;
          }
          return true;
        },
        message: "Rejection reason is required when document status is Rejected",
      },
    },

    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "employee_documents",
  }
);

// Helper virtual to check if document is expired based on current date
documentSchema.virtual("isExpired").get(function () {
  if (!this.expiry_date) return false;
  return new Date(this.expiry_date) < new Date();
});

// Configure JSON output to include virtuals
documentSchema.set("toJSON", { virtuals: true });
documentSchema.set("toObject", { virtuals: true });

const Document = mongoose.model("Document", documentSchema);
export default Document;
