import { useEffect, useMemo, useRef, useState } from "react";
import {
  clearAdminPassword,
  getSurveyQuestions,
  getStoredAdminPassword,
  getSurveyResponses,
  getNextQuestion,
  saveSurveyProgress,
  setAdminPassword,
  startSurvey,
  submitSurvey,
} from "./api";

const ANIMATION_MS = 420;

function normalizeValue(question, value) {
  if (question.type === "multiple-choice" || question.type === "ranking") {
    return Array.isArray(value) ? value : [];
  }

  return value ?? "";
}

function buildAnswerArray(answersMap) {
  return Object.entries(answersMap).map(([questionKey, value]) => ({
    questionKey,
    value,
  }));
}

function getQuestionError(question, value) {
  if (!question) {
    return "";
  }

  if (question.required) {
    if (
      value === undefined ||
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0)
    ) {
      return "Please answer this question before moving ahead.";
    }
  }

  if (question.type === "multiple-choice") {
    if (question.minSelections && value.length < question.minSelections) {
      return `Please select at least ${question.minSelections} options.`;
    }

    if (question.maxSelections && value.length > question.maxSelections) {
      return `Please select at most ${question.maxSelections} options.`;
    }
  }

  if (question.type === "ranking") {
    if (question.minSelections && value.length < question.minSelections) {
      return `Please rank ${question.minSelections} choices before moving ahead.`;
    }
  }

  if (question.type === "email" && value) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(String(value).trim())) {
      return "Please enter a valid email address.";
    }
  }

  return "";
}

function findInlineOtherQuestion(question, allQuestions, answerValue) {
  if (!question || !Array.isArray(question.options)) {
    return null;
  }

  const hasOtherOption = question.options.some((option) => option.value === "other");
  if (!hasOtherOption) {
    return null;
  }

  const selectedOther = Array.isArray(answerValue)
    ? answerValue.includes("other")
    : answerValue === "other";

  if (!selectedOther) {
    return null;
  }

  return (
    allQuestions.find((candidate) => {
      if (!candidate.key.endsWith("_other")) {
        return false;
      }

      return candidate.conditions?.some(
        (condition) =>
          condition.questionKey === question.key && condition.value === "other"
      );
    }) || null
  );
}

function isInlineEmbeddedQuestion(question) {
  if (!question || !question.key.endsWith("_other")) {
    return false;
  }

  return question.conditions?.some((condition) => condition.value === "other");
}

function AnswerField({ question, value, onChange }) {
  if (!question) {
    return null;
  }

  if (question.type === "single-choice") {
    return (
      <div className="options-grid">
        {question.options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`option-card ${value === option.value ? "selected" : ""}`}
            onClick={() => onChange(option.value)}
          >
            <span className="option-label">{option.label}</span>
          </button>
        ))}
      </div>
    );
  }

  if (question.type === "multiple-choice") {
    const selectedValues = Array.isArray(value) ? value : [];

    return (
      <div className="options-grid">
        {question.options.map((option) => {
          const selected = selectedValues.includes(option.value);

          return (
            <button
              key={option.value}
              type="button"
              className={`option-card ${selected ? "selected" : ""}`}
              onClick={() => {
                if (selected) {
                  onChange(selectedValues.filter((item) => item !== option.value));
                  return;
                }

                if (
                  question.maxSelections &&
                  selectedValues.length >= question.maxSelections
                ) {
                  return;
                }

                onChange([...selectedValues, option.value]);
              }}
            >
              <span className="option-label">{option.label}</span>
              <span className="option-meta">
                {selected ? "Selected" : "Tap to select"}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  if (question.type === "ranking") {
    const rankedValues = Array.isArray(value) ? value : [];

    return (
      <div className="options-grid">
        {question.options.map((option) => {
          const rank = rankedValues.indexOf(option.value);

          return (
            <button
              key={option.value}
              type="button"
              className={`option-card ${rank >= 0 ? "selected" : ""}`}
              onClick={() => {
                if (rank >= 0) {
                  onChange(rankedValues.filter((item) => item !== option.value));
                  return;
                }

                if (
                  question.maxSelections &&
                  rankedValues.length >= question.maxSelections
                ) {
                  return;
                }

                onChange([...rankedValues, option.value]);
              }}
            >
              <span className="option-rank">{rank >= 0 ? rank + 1 : "+"}</span>
              <span className="option-label">{option.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  if (question.type === "email") {
    return (
      <input
        className="text-input"
        type="email"
        placeholder={question.placeholder || "name@company.com"}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  return (
    <textarea
      className="text-input"
      rows={5}
      placeholder={question.placeholder || "Type your answer"}
      value={typeof value === "string" ? value : ""}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  value,
  onChange,
  inlineOtherQuestion,
  inlineOtherValue,
  onInlineOtherChange,
  errorMessage,
  statusText,
  actionButtons,
  animationClass,
  scrollContainerRef,
}) {
  return (
    <article className={`question-card ${animationClass}`}>
      <div className="question-card-scroll" ref={scrollContainerRef}>
        <div className="question-topline">
          <span className="question-index">
            {question.code} - {questionNumber} / {totalQuestions}
          </span>
          {statusText ? <span className="status-pill">{statusText}</span> : null}
        </div>

        <h1 className="question-prompt">
  {question.prompt.replace(" (Select all that apply)", "")}
  {question.prompt.includes("(Select all that apply)") && (
    <>
      <br />
      <span className="question-helper">(Select all that apply)</span>
    </>
  )}
</h1>

        {question.description ? (
          <p className="question-description">{question.description}</p>
        ) : null}

        <AnswerField question={question} value={value} onChange={onChange} />

        {inlineOtherQuestion ? (
          <div className="inline-followup">
            <label className="inline-followup-label" htmlFor={inlineOtherQuestion.key}>
              {inlineOtherQuestion.prompt}
            </label>
            {inlineOtherQuestion.type === "email" ? (
              <input
                id={inlineOtherQuestion.key}
                className="text-input"
                type="email"
                placeholder={inlineOtherQuestion.placeholder || "Type your answer"}
                value={inlineOtherValue}
                onChange={(event) => onInlineOtherChange(event.target.value)}
              />
            ) : (
              <textarea
                id={inlineOtherQuestion.key}
                className="text-input"
                rows={4}
                placeholder={inlineOtherQuestion.placeholder || "Type your answer"}
                value={inlineOtherValue}
                onChange={(event) => onInlineOtherChange(event.target.value)}
              />
            )}
          </div>
        ) : null}

        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
      </div>

      {actionButtons ? <div className="question-card-footer">{actionButtons}</div> : null}
    </article>
  );
}

function formatAnswerValue(value) {
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return String(value);
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString();
}

function AdminPage() {
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedResponse, setSelectedResponse] = useState(null);
  const [passwordInput, setPasswordInput] = useState(getStoredAdminPassword());
  const [isAuthenticated, setIsAuthenticated] = useState(
    Boolean(getStoredAdminPassword())
  );

  useEffect(() => {
    async function loadResponses() {
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }

      try {
        const data = await getSurveyResponses();
        const filteredResponses = Array.isArray(data)
          ? data.filter(
              (response) =>
                response.status === "completed" ||
                (response.answers && response.answers.length > 0)
            )
          : [];
        setResponses(filteredResponses);
        setErrorMessage("");
      } catch (error) {
        setErrorMessage(error.message || "Failed to load responses");
        if (error.message === "Unauthorized") {
          clearAdminPassword();
          setIsAuthenticated(false);
        }
      } finally {
        setLoading(false);
      }
    }

    loadResponses();
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <main className="app-shell admin-shell">
        <section className="admin-stage auth-stage">
          <div className="admin-header-card auth-card">
            <div>
              <p className="admin-eyebrow">Admin Access</p>
              <h1 className="admin-title">Enter admin password</h1>
              <p className="admin-subtitle">
                This page is protected. Ask the project owner for the password.
              </p>
            </div>

            <form
              className="admin-auth-form"
              onSubmit={(event) => {
                event.preventDefault();
                setAdminPassword(passwordInput);
                setLoading(true);
                setIsAuthenticated(true);
              }}
            >
              <input
                className="text-input admin-password-input"
                type="password"
                placeholder="Admin password"
                value={passwordInput}
                onChange={(event) => setPasswordInput(event.target.value)}
              />
              <button className="admin-link auth-submit" type="submit">
                Open admin
              </button>
            </form>

            {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
          </div>
        </section>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="app-shell admin-shell">
        <section className="admin-stage">
          <div className="empty-state">Loading saved responses...</div>
        </section>
      </main>
    );
  }

  if (errorMessage) {
    return (
      <main className="app-shell admin-shell">
        <section className="admin-stage">
          <div className="empty-state error">
            <h1>Unable to load responses</h1>
            <p>{errorMessage}</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell admin-shell">
      <section className="admin-stage">
        <div className="admin-header-card">
          <div>
            <p className="admin-eyebrow">Admin View</p>
            <h1 className="admin-title">Saved survey responses</h1>
            <p className="admin-subtitle">
              Total responses: {responses.length}
            </p>
          </div>
          <a className="admin-link" href="/">
            Open survey
          </a>
        </div>

        {responses.length === 0 ? (
          <div className="empty-state">
            <h1>No responses yet</h1>
            <p>Submitted and saved survey responses will appear here.</p>
          </div>
        ) : (
          <div className="admin-table-card">
            <div className="admin-table-scroll">
              <table className="response-table">
                <thead>
                  <tr>
                    <th>Session ID</th>
                    <th>Country</th>
                    <th>Started</th>
                    <th>Submitted</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {responses.map((response) => (
                    <tr
                      key={response._id || response.sessionId}
                      className="response-table-row"
                      onClick={() => setSelectedResponse(response)}
                    >
                      <td className="session-cell">{response.sessionId}</td>
                      <td>{response.countryName || "Unknown"}</td>
                      <td>{formatDateTime(response.startedAt || response.createdAt)}</td>
                      <td>{formatDateTime(response.submittedAt)}</td>
                      <td>
                        <span
                          className={`status-badge ${
                            response.status === "completed"
                              ? "status-completed"
                              : "status-draft"
                          }`}
                        >
                          {response.status || "draft"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {selectedResponse ? (
        <div
          className="modal-backdrop"
          onClick={() => setSelectedResponse(null)}
          role="presentation"
        >
          <div
            className="response-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => setSelectedResponse(null)}
              aria-label="Close response details"
            >
              ×
            </button>

            <div className="modal-header">
              <div>
                <p className="admin-eyebrow">Response Details</p>
                <h2 className="modal-title">{selectedResponse.sessionId}</h2>
              </div>
              <span
                className={`status-badge ${
                  selectedResponse.status === "completed"
                    ? "status-completed"
                    : "status-draft"
                }`}
              >
                {selectedResponse.status || "draft"}
              </span>
            </div>

            <div className="modal-meta-grid">
              <div className="modal-meta-card">
                <span className="modal-meta-label">Country</span>
                <strong>{selectedResponse.countryName || "Unknown"}</strong>
              </div>
              <div className="modal-meta-card">
                <span className="modal-meta-label">IP Address</span>
                <strong>{selectedResponse.ipAddress || "-"}</strong>
              </div>
              <div className="modal-meta-card">
                <span className="modal-meta-label">Started</span>
                <strong>
                  {formatDateTime(
                    selectedResponse.startedAt || selectedResponse.createdAt
                  )}
                </strong>
              </div>
              <div className="modal-meta-card">
                <span className="modal-meta-label">Submitted</span>
                <strong>{formatDateTime(selectedResponse.submittedAt)}</strong>
              </div>
            </div>

            <div className="modal-table-scroll">
              <table className="response-detail-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Question</th>
                    <th>Answer</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedResponse.answers || []).map((answer) => (
                    <tr
                      key={`${selectedResponse.sessionId}-${answer.questionKey}`}
                    >
                      <td>{answer.questionCode || answer.questionKey}</td>
                      <td>{answer.prompt || answer.questionKey}</td>
                      <td>{formatAnswerValue(answer.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function SurveyPage() {
  const [sessionId, setSessionId] = useState("");
  const [startedAt, setStartedAt] = useState("");
  const [allQuestions, setAllQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionTrail, setQuestionTrail] = useState([]);
  const [answersMap, setAnswersMap] = useState({});
  const [visibleQuestionKeys, setVisibleQuestionKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [transitionState, setTransitionState] = useState("idle");
  const [incomingQuestion, setIncomingQuestion] = useState(null);
  const [isGoingBack, setIsGoingBack] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const timerRef = useRef(null);
  const currentScrollRef = useRef(null);

  useEffect(() => {
    async function bootstrap() {
      try {
        const [questionsData, startData] = await Promise.all([
          getSurveyQuestions(),
          startSurvey(),
        ]);

        const questions = questionsData.questions || [];
        setAllQuestions(questions);
        setSessionId(startData.sessionId);
        setStartedAt(startData.startedAt || new Date().toISOString());
        setCurrentQuestion(startData.firstQuestion);
        setVisibleQuestionKeys(startData.firstQuestion ? [startData.firstQuestion.key] : []);
        setQuestionTrail(startData.firstQuestion ? [startData.firstQuestion.key] : []);
      } catch (error) {
        setErrorMessage(error.message || "Failed to load survey");
      } finally {
        setLoading(false);
      }
    }

    bootstrap();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const currentValue = useMemo(() => {
    if (!currentQuestion) {
      return "";
    }

    return normalizeValue(currentQuestion, answersMap[currentQuestion.key]);
  }, [answersMap, currentQuestion]);

  const questionMap = useMemo(
    () => new Map(allQuestions.map((question) => [question.key, question])),
    [allQuestions]
  );
  const visibleScreenKeys = useMemo(
    () =>
      visibleQuestionKeys.filter((key) => !isInlineEmbeddedQuestion(questionMap.get(key))),
    [questionMap, visibleQuestionKeys]
  );
  const trailScreenKeys = useMemo(
    () =>
      questionTrail.filter((key) => !isInlineEmbeddedQuestion(questionMap.get(key))),
    [questionMap, questionTrail]
  );

  const questionNumber = useMemo(() => {
    if (!currentQuestion) {
      return 0;
    }

    const visibleIndex = visibleScreenKeys.indexOf(currentQuestion.key);
    if (visibleIndex >= 0) {
      return visibleIndex + 1;
    }

    const trailIndex = trailScreenKeys.indexOf(currentQuestion.key);
    return trailIndex >= 0 ? trailIndex + 1 : 1;
  }, [currentQuestion, trailScreenKeys, visibleScreenKeys]);

  const totalQuestions = Math.max(
    visibleScreenKeys.length,
    trailScreenKeys.length,
    questionNumber
  );

  function updateAnswer(value) {
    setSaveMessage("");
    setSubmitError("");
    setErrorMessage("");

    setAnswersMap((previous) => {
      const nextAnswers = {
        ...previous,
        [currentQuestion.key]: value,
      };

      const inlineOtherQuestion = findInlineOtherQuestion(
        currentQuestion,
        allQuestions,
        value
      );

      if (!inlineOtherQuestion) {
        const staleOtherQuestion = allQuestions.find((question) =>
          question.conditions?.some(
            (condition) =>
              condition.questionKey === currentQuestion.key && condition.value === "other"
          )
        );

        if (staleOtherQuestion) {
          delete nextAnswers[staleOtherQuestion.key];
        }
      }

      return nextAnswers;
    });
  }

  function hasAnswer(question, value) {
    if (!question) {
      return false;
    }

    if (question.type === "multiple-choice" || question.type === "ranking") {
      return Array.isArray(value) && value.length > 0;
    }

    return String(value ?? "").trim().length > 0;
  }
  function goBack() {
  if (!currentQuestion || transitionState !== "idle") return;

  const currentIndex = questionTrail.indexOf(currentQuestion.key);

  if (currentIndex <= 0) return; // already first question

  const previousKey = questionTrail[currentIndex - 1];
  const previousQuestion = questionMap.get(previousKey);

  if (!previousQuestion) return;

  setIncomingQuestion(previousQuestion);
  setIsGoingBack(true);
  setTransitionState("sliding");

  timerRef.current = setTimeout(() => {
    setCurrentQuestion(previousQuestion);
    setIncomingQuestion(null);
    setTransitionState("idle");
    setIsGoingBack(false);
  }, ANIMATION_MS);
}
  async function fetchNextQuestion(mode) {
  if (!currentQuestion || transitionState !== "idle") return;

  const answerValue = normalizeValue(
    currentQuestion,
    answersMap[currentQuestion.key]
  );

  const inlineOtherQuestion = findInlineOtherQuestion(
    currentQuestion,
    allQuestions,
    answerValue
  );

  const inlineOtherValue = inlineOtherQuestion
    ? normalizeValue(inlineOtherQuestion, answersMap[inlineOtherQuestion.key])
    : "";

  const currentQuestionError = getQuestionError(currentQuestion, answerValue);
  if (currentQuestionError) {
    setErrorMessage(currentQuestionError);
    return;
  }

  if (inlineOtherQuestion) {
    const inlineError = getQuestionError(
      inlineOtherQuestion,
      inlineOtherValue
    );

    if (inlineError) {
      setErrorMessage(inlineError);
      return;
    }
  }

  const navigationQuestionKey = inlineOtherQuestion
    ? inlineOtherQuestion.key
    : currentQuestion.key;

  const nextAnswersMap = {
    ...answersMap,
    [currentQuestion.key]: answerValue,
  };

  if (inlineOtherQuestion) {
    nextAnswersMap[inlineOtherQuestion.key] = inlineOtherValue;
  }

  const answers = buildAnswerArray(nextAnswersMap);

  try {
    setIsSubmitting(true);
    setErrorMessage("");
    setSubmitError("");
    setSaveMessage("");

    // STEP 1: Get next question first
    const nextData = await getNextQuestion({
      currentQuestionKey: navigationQuestionKey,
      answers,
    });

    // STEP 2: Save in background (do not wait)
    if (mode === "save") {
      saveSurveyProgress({
        sessionId,
        startedAt,
        lastQuestionKey: navigationQuestionKey,
        answers,
      }).catch(() => {});
    }

    // STEP 3: Finish survey
    if (!nextData.nextQuestion) {
      await submitSurvey({
        sessionId,
        startedAt,
        answers,
      });

      setCurrentQuestion(null);
      setTransitionState("completed");
      return;
    }

    // STEP 4: Show next immediately
    setVisibleQuestionKeys(nextData.visibleQuestionKeys || []);
    setQuestionTrail((prev) =>
      prev.includes(nextData.nextQuestion.key)
        ? prev
        : [...prev, nextData.nextQuestion.key]
    );

    setIncomingQuestion(nextData.nextQuestion);
    setTransitionState("sliding");

    timerRef.current = setTimeout(() => {
      setCurrentQuestion(nextData.nextQuestion);
      setIncomingQuestion(null);
      setTransitionState("idle");
    }, ANIMATION_MS);

  } catch (error) {
    setSubmitError(error.message || "Something went wrong");
  } finally {
    setIsSubmitting(false);
  }
}

  const inlineOtherQuestion = findInlineOtherQuestion(
    currentQuestion,
    allQuestions,
    currentValue
  );
  const inlineOtherValue = inlineOtherQuestion
    ? normalizeValue(inlineOtherQuestion, answersMap[inlineOtherQuestion.key])
    : "";

  useEffect(() => {
    if (currentScrollRef.current) {
      currentScrollRef.current.scrollTop = 0;
    }
  }, [currentQuestion?.key]);

  if (loading) {
    return (
      <main className="app-shell">
        <section className="survey-stage">
          <div className="empty-state">Loading your survey...</div>
        </section>
      </main>
    );
  }

  if (!currentQuestion && transitionState === "completed") {
    return (
      <main className="app-shell">
        <section className="survey-stage">
          <div className="empty-state success">
            <h1>Thank you.</h1>
            <p>Your responses have been submitted successfully.</p>
          </div>
        </section>
      </main>
    );
  }

  if (!currentQuestion) {
    return (
      <main className="app-shell">
        <section className="survey-stage">
          <div className="empty-state error">
            <h1>Unable to load survey</h1>
            <p>{errorMessage || "Please make sure the backend is running."}</p>
          </div>
        </section>
      </main>
    );
  }

  const readyForActions = hasAnswer(currentQuestion, currentValue);
  const actionButtons = (
  <div className="action-row">
    <button
      type="button"
      className="action-button secondary"
      disabled={questionNumber === 1 || isSubmitting}
      onClick={goBack}
    >
      Back
    </button>

    <button
      type="button"
      className="action-button subtle"
      disabled={isSubmitting || !readyForActions}
      onClick={() => fetchNextQuestion("save")}
    >
      {isSubmitting ? "Saving..." : "Save & Next"}
    </button>
  </div>
);

  const incomingQuestionNumber = incomingQuestion
    ? Math.max(visibleScreenKeys.indexOf(incomingQuestion.key) + 1, questionNumber + 1, 1)
    : 0;

  return (
    <main className="app-shell">
      <section className="survey-stage">
        <div className="question-frame">
          <QuestionCard
            question={currentQuestion}
            questionNumber={questionNumber}
            totalQuestions={totalQuestions}
            value={currentValue}
            onChange={updateAnswer}
            inlineOtherQuestion={inlineOtherQuestion}
            inlineOtherValue={inlineOtherValue}
            onInlineOtherChange={(value) => {
              setSaveMessage("");
              setSubmitError("");
              setErrorMessage("");
              setAnswersMap((previous) => ({
                ...previous,
                [inlineOtherQuestion.key]: value,
              }));
            }}
            errorMessage={errorMessage || submitError}
            statusText={saveMessage}
            actionButtons={actionButtons}
            animationClass={
  transitionState === "sliding"
    ? isGoingBack
      ? "slide-out-right"
      : "slide-out-left"
    : ""
}
            scrollContainerRef={currentScrollRef}
          />

          {incomingQuestion ? (
            <QuestionCard
              question={incomingQuestion}
              questionNumber={incomingQuestionNumber}
              totalQuestions={Math.max(totalQuestions, visibleQuestionKeys.length)}
              value={normalizeValue(
                incomingQuestion,
                answersMap[incomingQuestion.key]
              )}
              onChange={() => {}}
              inlineOtherQuestion={null}
              inlineOtherValue=""
              onInlineOtherChange={() => {}}
              errorMessage=""
              statusText=""
              actionButtons={null}
              animationClass={
  isGoingBack
    ? "slide-in-left overlay-card"
    : "slide-in-right overlay-card"
}
              scrollContainerRef={null}
            />
          ) : null}
        </div>
      </section>
    </main>
  );
}

export default function App() {
  const isAdminPage =
    typeof window !== "undefined" && window.location.pathname === "/admin";

  return isAdminPage ? <AdminPage /> : <SurveyPage />;
}
