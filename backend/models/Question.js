const mongoose = require("mongoose");

const optionSchema = new mongoose.Schema(
  {
    value: {
      type: String,
      required: true,
      trim: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const conditionSchema = new mongoose.Schema(
  {
    questionKey: {
      type: String,
      required: true,
      trim: true,
    },
    operator: {
      type: String,
      enum: ["equals", "notEquals", "includes", "notIncludes", "in", "notIn"],
      default: "equals",
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  { _id: false }
);

const questionSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
    },
    section: {
      type: String,
      enum: ["profile", "research", "follow-up"],
      required: true,
    },
    prompt: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: [
        "text",
        "email",
        "single-choice",
        "multiple-choice",
        "ranking",
      ],
      default: "single-choice",
    },
    options: {
      type: [optionSchema],
      default: [],
    },
    required: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
    },
    placeholder: {
      type: String,
      default: "",
    },
    description: {
      type: String,
      default: "",
    },
    maxSelections: {
      type: Number,
      default: null,
    },
    minSelections: {
      type: Number,
      default: null,
    },
    conditions: {
      type: [conditionSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

questionSchema.index({ order: 1 });

module.exports = mongoose.model("Question", questionSchema);
