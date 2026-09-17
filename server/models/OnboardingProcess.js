import mongoose from "mongoose";

const checklistItemSchema = new mongoose.Schema({
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
  assigned_to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Employees",
    default: null,
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

const onboardingProcessSchema = new mongoose.Schema(
  {
    employee_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: [true, "Employee reference is required"],
      index: true,
    },

    status: {
      type: String,
      enum: ["Not Started", "In Progress", "Completed"],
      default: "In Progress",
      index: true,
    },

    checklist: [checklistItemSchema],

    start_date: {
      type: Date,
      default: null,
    },

    completed_at: {
      type: Date,
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
    collection: "onboarding_processes",
  }
);

// Virtual for overall progress percentage
onboardingProcessSchema.virtual("progress").get(function () {
  if (!this.checklist || this.checklist.length === 0) return 0;
  const doneCount = this.checklist.filter((item) => item.status === "Done").length;
  return Math.round((doneCount / this.checklist.length) * 100);
});

onboardingProcessSchema.set("toJSON", { virtuals: true });
onboardingProcessSchema.set("toObject", { virtuals: true });

const OnboardingProcess = mongoose.model(
  "OnboardingProcess",
  onboardingProcessSchema
);

export default OnboardingProcess;
