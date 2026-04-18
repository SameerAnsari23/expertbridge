const API_BASE = import.meta.env.VITE_API_URL || "";
const ADMIN_PASSWORD_STORAGE_KEY = "expertbridge-admin-password";

function getAdminPassword() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(ADMIN_PASSWORD_STORAGE_KEY) || "";
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || "Request failed");
    error.details = data;
    throw error;
  }

  return data;
}

function createAdminRequest(path) {
  return request(path, {
    headers: {
      "x-admin-password": getAdminPassword(),
    },
  });
}

export function startSurvey() {
  return request("/api/survey/start");
}

export function getSurveyQuestions() {
  return request("/api/survey/questions");
}

export function getNextQuestion(payload) {
  return request("/api/survey/next", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function saveSurveyProgress(payload) {
  return request("/api/survey/save", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function submitSurvey(payload) {
  return request("/api/survey/submit", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getSurveyResponses() {
  return createAdminRequest("/api/survey/responses");
}

export function setAdminPassword(password) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(ADMIN_PASSWORD_STORAGE_KEY, password);
  }
}

export function clearAdminPassword() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(ADMIN_PASSWORD_STORAGE_KEY);
  }
}

export function getStoredAdminPassword() {
  return getAdminPassword();
}
