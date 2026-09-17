import mongoose from "mongoose";

const offboardingTaskSchema = new mongoose.Schema({
  task_name: {
    type: String,
    required: [true, "Task name is required"],
    trim: true,
  },
  category: {
    type: String,
    enum: ["HR", "IT", "Admin", "Finance"],
    default: "HR",
  },
  status: {
    type: String,
    enum: ["Pending", "In Progress", "Done"],
    default: "Pending",
  },
  due_date: {
    type: Date,
    default: null,
  },
  completed_at: {
    type: Date,
    default: null,
  },
  notes: {
    type: String,
    default: "",
    trim: true,
  },
});

const clearanceSignOffSchema = new mongoose.Schema(
  {
    signed: {
      type: Boolean,
      default: false,
    },
    signed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employees",
      default: null,
    },
    signed_at: {
      type: Date,
      default: null,
    },
    comments: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { _id: false }
);

const offboardingProcessSchema = new mongoose.Schema(
  {
    employee_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: [true, "Employee reference is required"],
      index: true,
    },

    resignation_date: {
      type: Date,
      required: [true, "Resignation date is required"],
    },

    last_working_day: {
      type: Date,
      required: [true, "Last working day is required"],
    },

    exit_reason: {
      type: String,
      default: "",
      trim: true,
    },

    status: {
      type: String,
      enum: ["In Progress", "Completed"],
      default: "In Progress",
      index: true,
    },

    checklist: [offboardingTaskSchema],

    clearance_status: {
      hr: {
        type: clearanceSignOffSchema,
        default: () => ({ signed: false }),
      },
      it: {
        type: clearanceSignOffSchema,
        default: () => ({ signed: false }),
      },
      finance: {
        type: clearanceSignOffSchema,
        default: () => ({ signed: false }),
      },
      manager: {
        type: clearanceSignOffSchema,
        default: () => ({ signed: false }),
      },
    },

    completed_at: {
      type: Date,
      default: null,
    },

    experience_letter_generated_at: {
      type: Date,
      default: null,
    },

    experience_letter_url: {
      type: String,
      default: null,
    },

    // ==========================================
    // PROVIDENT FUND (PF) SETTLEMENT
    // ==========================================
    pf_settled: {
      type: Boolean,
      default: false,
    },

    pf_settled_at: {
      type: Date,
      default: null,
    },

    pf_settlement_amount: {
      type: Number,
      default: 0,
      min: 0,
    },

    pf_settled_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employees",
      default: null,
    },

    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employees",
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
    collection: "offboarding_processes",
  }
);

// Virtual for overall progress percentage
offboardingProcessSchema.virtual("progress").get(function () {
  if (!this.checklist || this.checklist.length === 0) return 0;
  const doneCount = this.checklist.filter((item) => item.status === "Done").length;
  return Math.round((doneCount / this.checklist.length) * 100);
});

// Virtual for all department clearances signed
offboardingProcessSchema.virtual("isClearanceComplete").get(function () {
  const c = this.clearance_status;
  if (!c) return false;
  return !!(c.hr?.signed && c.it?.signed && c.finance?.signed && c.manager?.signed);
});

offboardingProcessSchema.set("toJSON", { virtuals: true });
offboardingProcessSchema.set("toObject", { virtuals: true });

const OffboardingProcess = mongoose.model(
  "OffboardingProcess",
  offboardingProcessSchema
);

export default OffboardingProcess;
