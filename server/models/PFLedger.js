import mongoose from "mongoose";

const pfHistorySchema = new mongoose.Schema(
  {
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    year: {
      type: Number,
      required: true,
      min: 2000,
    },
    monthly_salary: {
      type: Number,
      default: 0,
      min: 0,
    },
    pf_percentage: {
      type: Number,
      default: 12,
      min: 0,
    },
    pf_amount: {
      type: Number,
      required: true,
      min: 0,
    },
    payroll_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payroll",
      default: null,
    },
    recorded_at: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const pfLedgerSchema = new mongoose.Schema(
  {
    employee_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    total_accumulated_pf: {
      type: Number,
      default: 0,
      min: 0,
    },
    last_pf_contribution: {
      type: Number,
      default: 0,
      min: 0,
    },
    last_updated: {
      type: Date,
      default: Date.now,
    },
    history: [pfHistorySchema],
  },
  {
    timestamps: true,
  }
);

pfLedgerSchema.index({ employee_id: 1, organizationId: 1 }, { unique: true });

const PFLedger = mongoose.model("PFLedger", pfLedgerSchema);

export default PFLedger;
