const express = require("express");
const crypto = require("crypto");
const Question = require("../models/Question");
const Response = require("../models/Response");
const {
  buildAnswerMap,
  getFirstVisibleQuestion,
  getNextVisibleQuestion,
  getVisibleQuestions,
  sanitizeQuestion,
  toArray,
} = require("../utils/surveyFlow");

const router = express.Router();
const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-me";

async function loadQuestions() {
  return Question.find().sort({ order: 1, createdAt: 1 }).lean();
}

function getClientIpAddress(req) {
  const forwardedFor = req.headers["x-forwarded-for"];

  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim()) {
    return realIp.trim();
  }

  const socketIp =
    req.socket?.remoteAddress || req.connection?.remoteAddress || "";

  if (!socketIp) {
    return "";
  }

  if (socketIp === "::1" || socketIp === "127.0.0.1") {
    return "127.0.0.1";
  }

  if (socketIp.startsWith("::ffff:")) {
    return socketIp.replace("::ffff:", "");
  }

  return socketIp;
}

function getCountryMetadata(req, ipAddress) {
  const rawCountryCode =
    req.headers["cf-ipcountry"] ||
    req.headers["x-vercel-ip-country"] ||
    req.headers["x-country-code"] ||
    req.headers["cloudfront-viewer-country"] ||
    "";

  const countryCode =
    typeof rawCountryCode === "string" ? rawCountryCode.trim().toUpperCase() : "";

  if (countryCode && countryCode !== "XX") {
    return {
      countryCode,
      countryName: regionNames.of(countryCode) || countryCode,
    };
  }

  if (!ipAddress || ipAddress === "127.0.0.1" || ipAddress === "::1") {
    return {
      countryCode: "LOCAL",
      countryName: "Local development",
    };
  }

  return {
    countryCode: "",
    countryName: "Unknown",
  };
}

function getRequestMetadata(req) {
  const ipAddress = getClientIpAddress(req);
  const country = getCountryMetadata(req, ipAddress);

  return {
    ipAddress,
    countryCode: country.countryCode,
    countryName: country.countryName,
    userAgent: req.headers["user-agent"] || "",
  };
}

function normalizeStartedAt(startedAtValue) {
  const startedAt = startedAtValue ? new Date(startedAtValue) : new Date();
  return Number.isNaN(startedAt.getTime()) ? new Date() : startedAt;
}

function requireAdminAuth(req, res, next) {
  const providedPassword =
    req.headers["x-admin-password"] || req.query.adminPassword || "";

  if (providedPassword !== ADMIN_PASSWORD) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  next();
}

function validateAnswer(question, answerValue) {
  if (
    question.required &&
    (answerValue === undefined ||
      answerValue === null ||
      answerValue === "" ||
      (Array.isArray(answerValue) && answerValue.length === 0))
  ) {
    return `${question.code} is required`;
  }

  if (
    (answerValue === undefined || answerValue === null || answerValue === "") &&
    !question.required
  ) {
    return null;
  }

  if (question.type === "single-choice") {
    const allowed = question.options.map((option) => option.value);
    if (!allowed.includes(answerValue)) {
      return `${question.code} has an invalid answer`;
    }
  }

  if (question.type === "multiple-choice") {
    if (!Array.isArray(answerValue)) {
      return `${question.code} must be an array`;
    }

    const allowed = question.options.map((option) => option.value);
    const hasInvalidOption = answerValue.some((value) => !allowed.includes(value));

    if (hasInvalidOption) {
      return `${question.code} has invalid options`;
    }

    if (question.minSelections && answerValue.length < question.minSelections) {
      return `${question.code} requires at least ${question.minSelections} choices`;
    }

    if (question.maxSelections && answerValue.length > question.maxSelections) {
      return `${question.code} allows at most ${question.maxSelections} choices`;
    }
  }

  if (question.type === "ranking") {
    if (!Array.isArray(answerValue)) {
      return `${question.code} must be an array`;
    }

    if (question.minSelections && answerValue.length < question.minSelections) {
      return `${question.code} requires ${question.minSelections} ranked choices`;
    }

    if (question.maxSelections && answerValue.length > question.maxSelections) {
      return `${question.code} allows only ${question.maxSelections} ranked choices`;
    }

    const allowed = question.options.map((option) => option.value);
    const uniqueValues = new Set(answerValue);

    if (uniqueValues.size !== answerValue.length) {
      return `${question.code} contains duplicate rankings`;
    }

    const hasInvalidOption = answerValue.some((value) => !allowed.includes(value));
    if (hasInvalidOption) {
      return `${question.code} has invalid rankings`;
    }
  }

  if (question.type === "email" && answerValue) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(String(answerValue).trim())) {
      return `${question.code} must be a valid email`;
    }
  }

  return null;
}

function shapeAnswers(questions, answers) {
  const questionMap = new Map(questions.map((question) => [question.key, question]));

  return answers.map((answer) => {
    const question = questionMap.get(answer.questionKey);
    const normalizedValue =
      question &&
      (question.type === "multiple-choice" || question.type === "ranking")
        ? toArray(answer.value)
        : answer.value;

    return {
      questionKey: answer.questionKey,
      questionCode: question ? question.code : "",
      prompt: question ? question.prompt : "",
      type: question ? question.type : "",
      value: normalizedValue,
      savedAt: new Date(),
    };
  });
}

router.get("/survey/questions", async (req, res) => {
  try {
    const questions = await loadQuestions();
    res.json({
      questions: questions.map(sanitizeQuestion),
      totalQuestions: questions.length,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch questions" });
  }
});

router.get("/survey/start", async (req, res) => {
  try {
    const questions = await loadQuestions();
    const sessionId = crypto.randomUUID();
    const firstQuestion = getFirstVisibleQuestion(questions, {});
    const startedAt = new Date();

    res.json({
      sessionId,
      startedAt: startedAt.toISOString(),
      firstQuestion: firstQuestion ? sanitizeQuestion(firstQuestion) : null,
      totalQuestions: questions.length,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to start survey" });
  }
});

router.post("/survey/next", async (req, res) => {
  try {
    const { currentQuestionKey, answers = [] } = req.body;

    const questions = await loadQuestions();
    const answerMap = buildAnswerMap(answers);
    const nextQuestion = getNextVisibleQuestion(
      questions,
      answerMap,
      currentQuestionKey
    );
    const visibleQuestions = getVisibleQuestions(questions, answerMap);

    res.json({
      nextQuestion: nextQuestion ? sanitizeQuestion(nextQuestion) : null,
      isComplete: !nextQuestion,
      visibleQuestionKeys: visibleQuestions.map((question) => question.key),
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to resolve next question" });
  }
});

router.post("/survey/save", async (req, res) => {
  try {
    const {
      sessionId,
      answers = [],
      lastQuestionKey = null,
      startedAt: startedAtValue,
    } = req.body;

    if (!sessionId) {
      return res.status(400).json({ message: "sessionId is required" });
    }

    const questions = await loadQuestions();
    const shapedAnswers = shapeAnswers(questions, answers);
    const requestMetadata = getRequestMetadata(req);
    const existingResponse = await Response.findOne({ sessionId })
      .select("startedAt")
      .lean();
    const startedAt = existingResponse?.startedAt || normalizeStartedAt(startedAtValue);

    const draft = await Response.findOneAndUpdate(
      { sessionId },
      {
        sessionId,
        status: "draft",
        startedAt,
        ipAddress: requestMetadata.ipAddress,
        countryCode: requestMetadata.countryCode,
        countryName: requestMetadata.countryName,
        userAgent: requestMetadata.userAgent,
        answers: shapedAnswers,
        lastQuestionKey,
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    res.json({
      message: "Progress saved",
      sessionId: draft.sessionId,
      updatedAt: draft.updatedAt,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to save progress" });
  }
});

router.post("/survey/submit", async (req, res) => {
  try {
    const { sessionId, answers = [], startedAt: startedAtValue } = req.body;

    if (!sessionId) {
      return res.status(400).json({ message: "sessionId is required" });
    }

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ message: "answers are required" });
    }

    const questions = await loadQuestions();
    const requestMetadata = getRequestMetadata(req);
    const existingResponse = await Response.findOne({ sessionId })
      .select("startedAt")
      .lean();
    const startedAt = existingResponse?.startedAt || normalizeStartedAt(startedAtValue);
    const answerMap = buildAnswerMap(answers);
    const visibleQuestions = getVisibleQuestions(questions, answerMap);
    const visibleQuestionMap = new Map(
      visibleQuestions.map((question) => [question.key, question])
    );

    const validationErrors = [];

    for (const question of visibleQuestions) {
      const errorMessage = validateAnswer(question, answerMap[question.key]);
      if (errorMessage) {
        validationErrors.push(errorMessage);
      }
    }

    for (const answer of answers) {
      if (!visibleQuestionMap.has(answer.questionKey)) {
        continue;
      }

      const question = visibleQuestionMap.get(answer.questionKey);
      const normalizedValue =
        question.type === "multiple-choice" || question.type === "ranking"
          ? toArray(answer.value)
          : answer.value;

      const errorMessage = validateAnswer(question, normalizedValue);
      if (errorMessage && !validationErrors.includes(errorMessage)) {
        validationErrors.push(errorMessage);
      }
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        message: "Validation failed",
        errors: validationErrors,
      });
    }

    const shapedAnswers = shapeAnswers(questions, answers).filter((answer) =>
      visibleQuestionMap.has(answer.questionKey)
    );

    const response = await Response.findOneAndUpdate(
      { sessionId },
      {
        sessionId,
        status: "completed",
        startedAt,
        ipAddress: requestMetadata.ipAddress,
        countryCode: requestMetadata.countryCode,
        countryName: requestMetadata.countryName,
        userAgent: requestMetadata.userAgent,
        answers: shapedAnswers,
        lastQuestionKey: null,
        submittedAt: new Date(),
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    res.status(201).json({
      message: "Survey submitted successfully",
      sessionId: response.sessionId,
      submittedAt: response.submittedAt,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to submit survey" });
  }
});

router.get("/survey/responses", requireAdminAuth, async (req, res) => {
  try {
    const responses = await Response.find().sort({ createdAt: -1 }).lean();
    res.json(responses);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch responses" });
  }
});

router.get("/survey/responses/:sessionId", requireAdminAuth, async (req, res) => {
  try {
    const response = await Response.findOne({
      sessionId: req.params.sessionId,
    }).lean();

    if (!response) {
      return res.status(404).json({ message: "Response not found" });
    }

    res.json(response);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch response" });
  }
});

module.exports = router;
