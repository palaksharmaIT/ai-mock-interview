const API_BASE_URL = "http://127.0.0.1:8000";

export async function checkBackend() {
  const response = await fetch(
    `${API_BASE_URL}/api/interview/health/`
  );

  if (!response.ok) {
    throw new Error("Backend request failed");
  }

  return response.json();
}

export async function generateQuestions(experience, techStack) {
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