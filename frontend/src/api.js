const API_BASE_URL = "http://127.0.0.1:8000";


// --------------------------------------------------
// Check backend
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
  techStack
) {
  const response = await fetch(
    `${API_BASE_URL}/api/interview/generate-questions/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        experience,
        techStack,
      }),
    }
  );

  if (!response.ok) {
    throw new Error("Question generation failed");
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
}) {
  const response = await fetch(
    `${API_BASE_URL}/api/interview/sessions/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        techStack,
        experience,
        answers,
        evaluation,
        overallScore,
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(
      () => ({})
    );

    throw new Error(
      errorData.message ||
        "Unable to save interview session"
    );
  }

  return response.json();
}


// --------------------------------------------------
// Get previous interview sessions
// --------------------------------------------------

export async function getInterviewSessions() {
  const response = await fetch(
    `${API_BASE_URL}/api/interview/sessions/`
  );

  if (!response.ok) {
    throw new Error(
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
}) {
  const response = await fetch(
    `${API_BASE_URL}/api/interview/evaluate-interview/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        techStack,
        experience,
        answers,
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(
      () => ({})
    );

    throw new Error(
      errorData.message ||
        "Unable to evaluate interview"
    );
  }

  return response.json();
}