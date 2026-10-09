const API_BASE_URL = "http://127.0.0.1:8000";

// --------------------------------------------------
// Authentication headers
// --------------------------------------------------

async function authHeaders(token) {
  if (!token) {
    throw new Error(
      "Authentication required. Please sign in again."
    );
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

// --------------------------------------------------
// Handle API errors
// --------------------------------------------------

async function handleApiError(response, fallbackMessage) {
  const errorData = await response.json().catch(() => ({}));

  throw new Error(
    errorData.message ||
      errorData.detail ||
      fallbackMessage
  );
}

// --------------------------------------------------
// Check backend (public endpoint)
// --------------------------------------------------

export async function checkBackend() {
  const response = await fetch(
    `${API_BASE_URL}/api/interview/health/`
  );

  if (!response.ok) {
    throw new Error("Backend request failed");
  }

  return response.json();
}

// --------------------------------------------------
// Generate interview questions
// --------------------------------------------------

export async function generateQuestions(
  experience,
  techStack,
  token
) {
  const response = await fetch(
    `${API_BASE_URL}/api/interview/generate-questions/`,
    {
      method: "POST",
      headers: await authHeaders(token),
      body: JSON.stringify({
        experience,
        techStack,
      }),
    }
  );

  if (!response.ok) {
    await handleApiError(
      response,
      "Question generation failed"
    );
  }

  return response.json();
}

// --------------------------------------------------
// Save completed interview session
// --------------------------------------------------

export async function saveInterviewSession({
  techStack,
  experience,
  answers,
  evaluation,
  overallScore,
  proctoring = {},
  token,
}) {
  const response = await fetch(
    `${API_BASE_URL}/api/interview/sessions/`,
    {
      method: "POST",
      headers: await authHeaders(token),
      body: JSON.stringify({
        techStack,
        experience,
        answers,
        evaluation,
        overallScore,
        proctoring,
      }),
    }
  );

  if (!response.ok) {
    await handleApiError(
      response,
      "Unable to save interview session"
    );
  }

  return response.json();
}

// --------------------------------------------------
// Get previous interview sessions
// --------------------------------------------------

export async function getInterviewSessions(token) {
  const response = await fetch(
    `${API_BASE_URL}/api/interview/sessions/`,
    {
      method: "GET",
      headers: await authHeaders(token),
    }
  );

  if (!response.ok) {
    await handleApiError(
      response,
      "Unable to fetch interview sessions"
    );
  }

  return response.json();
}

// --------------------------------------------------
// Evaluate completed interview
// --------------------------------------------------

export async function evaluateInterview({
  techStack,
  experience,
  answers,
  token,
}) {
  const response = await fetch(
    `${API_BASE_URL}/api/interview/evaluate-interview/`,
    {
      method: "POST",
      headers: await authHeaders(token),
      body: JSON.stringify({
        techStack,
        experience,
        answers,
      }),
    }
  );

  if (!response.ok) {
    await handleApiError(
      response,
      "Unable to evaluate interview"
    );
  }

  return response.json();
}
