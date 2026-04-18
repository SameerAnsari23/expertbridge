const mongoose = require("mongoose");

const answerSchema = new mongoose.Schema(
  {
    questionKey: {
      type: String,
      required: true,
      trim: true,
    },
    questionCode: {
      type: String,
      trim: true,
    },
    prompt: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      trim: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    savedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const responseSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["draft", "completed"],
      default: "draft",
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    ipAddress: {
      type: String,
      default: "",
      trim: true,
    },
    countryCode: {
      type: String,
      default: "",
      trim: true,
    },
    countryName: {
      type: String,
      default: "Unknown",
      trim: true,
    },
    userAgent: {
      type: String,
      default: "",
      trim: true,
    },
    answers: {
      type: [answerSchema],
      default: [],
    },
    lastQuestionKey: {
      type: String,
      default: null,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Response", responseSchema);
