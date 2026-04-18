const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const surveyRoutes = require("./routes/surveyRoutes");

dotenv.config();

const app = express();

const MONGODB_URI = process.env.MONGODB_URI;

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json());

app.use("/api", surveyRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "Survey backend is running",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

let isConnected = false;

async function connectDB() {
  if (isConnected) return;

  await mongoose.connect(MONGODB_URI);
  isConnected = true;
  console.log("MongoDB connected");
}

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

module.exports = app;
