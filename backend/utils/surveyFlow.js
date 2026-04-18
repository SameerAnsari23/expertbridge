function toArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value === undefined || value === null || value === "") {
    return [];
  }

  return [value];
}

function buildAnswerMap(answers) {
  return answers.reduce((accumulator, answer) => {
    accumulator[answer.questionKey] = answer.value;
    return accumulator;
  }, {});
}

function compareCondition(answerValue, condition) {
  const selectedValues = toArray(answerValue);
  const expectedValues = toArray(condition.value);

  switch (condition.operator) {
    case "equals":
      return answerValue === condition.value;
    case "notEquals":
      return answerValue !== condition.value;
    case "includes":
      return selectedValues.includes(condition.value);
    case "notIncludes":
      return !selectedValues.includes(condition.value);
    case "in":
      return expectedValues.includes(answerValue);
    case "notIn":
      return !expectedValues.includes(answerValue);
    default:
      return false;
  }
}

function isQuestionVisible(question, answerMap) {
  if (!question.conditions || question.conditions.length === 0) {
    return true;
  }

  return question.conditions.every((condition) => {
    const answerValue = answerMap[condition.questionKey];
    return compareCondition(answerValue, condition);
  });
}

function getVisibleQuestions(questions, answerMap) {
  return questions.filter((question) => isQuestionVisible(question, answerMap));
}

function getFirstVisibleQuestion(questions, answerMap) {
  return getVisibleQuestions(questions, answerMap)[0] || null;
}

function getNextVisibleQuestion(questions, answerMap, currentQuestionKey) {
  const visibleQuestions = getVisibleQuestions(questions, answerMap);
  const currentIndex = visibleQuestions.findIndex(
    (question) => question.key === currentQuestionKey
  );

  if (currentIndex === -1) {
    return visibleQuestions[0] || null;
  }

  return visibleQuestions[currentIndex + 1] || null;
}

function sanitizeQuestion(question) {
  return {
    id: question._id,
    key: question.key,
    code: question.code,
    section: question.section,
    prompt: question.prompt,
    type: question.type,
    options: question.options,
    required: question.required,
    order: question.order,
    placeholder: question.placeholder,
    description: question.description,
    minSelections: question.minSelections,
    maxSelections: question.maxSelections,
    conditions: question.conditions,
  };
}

module.exports = {
  buildAnswerMap,
  getFirstVisibleQuestion,
  getNextVisibleQuestion,
  getVisibleQuestions,
  isQuestionVisible,
  sanitizeQuestion,
  toArray,
};
