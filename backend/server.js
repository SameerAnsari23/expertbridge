const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const surveyRoutes = require("./routes/surveyRoutes");

dotenv.config();

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json());

// Connect DB before every request
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    res.status(500).json({
      message: "Database connection failed",
      error: error.message,
    });
  }
});

// Root route
app.get("/", (req, res) => {
  res.json({
    message: "Survey backend is running",
  });
});

// API routes
app.use("/api", surveyRoutes);

// Health route
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    database: "connected",
  });
});

module.exports = app;
