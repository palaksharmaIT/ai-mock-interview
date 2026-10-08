import { useEffect, useState } from "react";
import {
  generateQuestions,
  saveInterviewSession,
  getInterviewSessions,
  evaluateInterview,
} from "./api";

import {
  SignedIn,
  SignedOut,
  SignIn,
  SignUp,
  UserButton,
  useUser,
} from "@clerk/clerk-react";

import InterviewSetupModal from "./components/InterviewSetupModal";
import PermissionStep from "./components/PermissionStep";
import InterviewRoom from "./components/InterviewRoom";
import Dashboard from "./components/Dashboard";

import "./App.css";

// --------------------------------------------------
// Clerk appearance
// --------------------------------------------------

const appearance = {
  variables: {
    colorPrimary: "#b4452a",
    colorText: "#1d1b17",
    colorBackground: "transparent",
    fontFamily: "'Instrument Sans', system-ui, sans-serif",
    borderRadius: "3px",
  },

  elements: {
    rootBox: {
      width: "100%",
    },

    cardBox: {
      width: "100%",
      boxShadow: "none",
    },

    card: {
      boxShadow: "none",
      background: "transparent",
      border: "none",
      padding: 0,
    },

    header: {
      display: "none",
    },

    footerAction: {
      display: "none",
    },
  },
};

// --------------------------------------------------
// Helper
// --------------------------------------------------

const levelText = (exp) => {
  return exp === "Fresher" ? "Fresher" : `${exp} years`;
};

// --------------------------------------------------
// Authentication Page
// --------------------------------------------------

function AuthPage() {
  const [mode, setMode] = useState("signin");

  return (
    <div className="page">
      <section className="story">
        <div className="mark">
          Rehearsal<span>.</span>
        </div>

        <div>
          <h1>
            Practice like it's <em>real.</em>
          </h1>

          <p className="lede">
            A focused AI mock interview experience designed to help you
            prepare, practice, and improve.
          </p>
        </div>

        <ol className="steps">
          <li>
            <span className="n">01</span>

            <div>
              <strong>Set your interview</strong>

              <p>
                Choose your experience level and tech stack.
              </p>
            </div>
          </li>

          <li>
            <span className="n">02</span>

            <div>
              <strong>Practice naturally</strong>

              <p>
                Answer questions using your camera and microphone.
              </p>
            </div>
          </li>

          <li>
            <span className="n">03</span>

            <div>
              <strong>Get feedback</strong>

              <p>
                Review your performance and identify areas to improve.
              </p>
            </div>
          </li>
        </ol>

        <blockquote className="sample">
          <span>Interview mindset</span>

          “You don't need perfect answers. You need practice.”
        </blockquote>
      </section>

      <section className="panel">
        <div className="tabs" role="tablist">
          <button
            role="tab"
            aria-selected={mode === "signin"}
            className={mode === "signin" ? "on" : ""}
            onClick={() => setMode("signin")}
          >
            Sign in
          </button>

          <button
            role="tab"
            aria-selected={mode === "signup"}
            className={mode === "signup" ? "on" : ""}
            onClick={() => setMode("signup")}
          >
            Sign up
          </button>
        </div>

        {mode === "signin" ? (
          <>
            <h2>Welcome back.</h2>

            <p className="sub">
              Continue your interview practice.
            </p>

            <SignIn
              routing="hash"
              appearance={appearance}
            />
          </>
        ) : (
          <>
            <h2>Create your account.</h2>

            <p className="sub">
              Start preparing for your next interview.
            </p>

            <SignUp
              routing="hash"
              appearance={appearance}
            />
          </>
        )}
      </section>
    </div>
  );
}

// --------------------------------------------------
// Old Home Component
// --------------------------------------------------

function Home({ onStart }) {
  const { user } = useUser();

  return (
    <main>
      <p className="eyebrow">
        {user?.firstName
          ? `Hello, ${user.firstName}`
          : "Hello"}
      </p>

      <h1>
        Ready for your mock interview?
      </h1>

      <p className="lede">
        Practice your technical interview with AI.
      </p>

      <ul className="facts">
        <li>10 questions</li>
        <li>About 30 minutes</li>
        <li>Camera and mic</li>
      </ul>

      <button
        className="cta"
        onClick={onStart}
      >
        Start Interview
      </button>
    </main>
  );
}

// --------------------------------------------------
// Signed-in Application
// --------------------------------------------------

function Signed() {
  const [step, setStep] = useState("dashboard");
  const [showModal, setShowModal] = useState(false);
  const [setup, setSetup] = useState(null);
  const [stream, setStream] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [finalAnswers, setFinalAnswers] = useState([]);
  const [evaluation, setEvaluation] = useState(null);
  const [questionError, setQuestionError] = useState("");
  const [evaluationError, setEvaluationError] = useState("");

  // ------------------------------------------------
  // Completed interview history
  // ------------------------------------------------

  const [completedSessions, setCompletedSessions] = useState(() => {
    try {
      const saved = localStorage.getItem("rehearsal_sessions");

      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error(
        "Unable to load local interview history:",
        error
      );

      return [];
    }
  });

  // ------------------------------------------------
  // Load sessions from Django
  // ------------------------------------------------

  useEffect(() => {
    const loadSessions = async () => {
      try {
        const data = await getInterviewSessions();

        const backendSessions = data.sessions || [];

        const localSessions = (() => {
          try {
            const saved =
              localStorage.getItem("rehearsal_sessions");

            return saved ? JSON.parse(saved) : [];
          } catch {
            return [];
          }
        })();

        const combinedSessions = [
          ...backendSessions,
          ...localSessions,
        ].filter(
          (session, index, self) =>
            index ===
            self.findIndex(
              (item) => String(item.id) === String(session.id)
            )
        );

        combinedSessions.sort(
          (a, b) =>
            new Date(b.completedAt || 0) -
            new Date(a.completedAt || 0)
        );

        setCompletedSessions(combinedSessions);

        console.log(
          "Interview sessions loaded:",
          combinedSessions
        );
      } catch (error) {
        console.error(
          "Unable to load interview sessions:",
          error
        );
      }
    };

    loadSessions();
  }, []);

  // ------------------------------------------------
  // Stop camera / microphone
  // ------------------------------------------------

  const stopStream = (currentStream = stream) => {
    currentStream?.getTracks().forEach((track) => {
      track.stop();
    });
  };

  // ------------------------------------------------
  // Generate interview questions
  // ------------------------------------------------

  const startInterview = async (cameraStream) => {
    setStep("loading");
    setQuestionError("");

    try {
      const data = await generateQuestions(
        setup.experience,
        setup.techStack
      );

      setQuestions(data.questions);
      setStream(cameraStream);
      setStep("interview");
    } catch (error) {
      console.error(
        "Question generation failed:",
        error
      );

      stopStream(cameraStream);

      setQuestionError(
        "Unable to generate interview questions. Please try again."
      );

      setStep("error");
    }
  };

  // ------------------------------------------------
  // Leave interview
  // ------------------------------------------------

  const leave = () => {
    stopStream();

    setStream(null);
    setQuestions([]);
    setFinalAnswers([]);
    setEvaluation(null);
    setQuestionError("");
    setEvaluationError("");

    setStep("dashboard");
  };

  // ------------------------------------------------
  // Finish interview
  // ------------------------------------------------

  const finish = async (answers) => {
    stopStream();

    setStream(null);
    setFinalAnswers(answers);
    setEvaluation(null);
    setEvaluationError("");

    const answeredQuestions = answers.filter(
      (item) => item.answer?.trim()
    ).length;

    // ----------------------------------------------
    // Step 1: Evaluate interview using AI
    // ----------------------------------------------

    setStep("evaluating");

    let aiEvaluation = null;

    try {
      const evaluationData = await evaluateInterview({
        techStack: setup?.techStack || "Technical",
        experience: setup?.experience || "Fresher",
        answers,
      });

      aiEvaluation = evaluationData.evaluation;

      setEvaluation(aiEvaluation);

      console.log(
        "AI evaluation received:",
        aiEvaluation
      );
    } catch (error) {
      console.error(
        "Interview evaluation failed:",
        error
      );

      setEvaluationError(
        "Unable to generate AI feedback. Your interview answers can still be saved."
      );
    }

    // ----------------------------------------------
    // Step 2: Save interview session
    // ----------------------------------------------

    const localSession = {
      id: Date.now(),
      techStack: setup?.techStack || "Technical",
      experience: setup?.experience || "Fresher",
      totalQuestions: answers.length,
      answeredQuestions,
      overallScore: aiEvaluation?.overallScore || 0,
      evaluation: aiEvaluation || {},
      completedAt: new Date().toISOString(),
    };

    try {
      const data = await saveInterviewSession({
        techStack: setup?.techStack || "Technical",
        experience: setup?.experience || "Fresher",
        answers,
        evaluation: aiEvaluation || {},
        overallScore: aiEvaluation?.overallScore || 0,
      });

      const backendSession = data.session;

      const updatedSessions = [
        backendSession,
        ...completedSessions,
      ];

      setCompletedSessions(updatedSessions);

      localStorage.setItem(
        "rehearsal_sessions",
        JSON.stringify(updatedSessions)
      );

      console.log(
        "Interview saved to Django:",
        backendSession
      );
    } catch (error) {
      console.error(
        "Unable to save interview to backend:",
        error
      );

      const updatedSessions = [
        localSession,
        ...completedSessions,
      ];

      setCompletedSessions(updatedSessions);

      localStorage.setItem(
        "rehearsal_sessions",
        JSON.stringify(updatedSessions)
      );

      console.log(
        "Interview saved locally as fallback:",
        localSession
      );
    }

    console.log(
      "Answers for feedback:",
      answers
    );

    setStep("finished");
  };

  // ------------------------------------------------
  // Interview Room
  // ------------------------------------------------

  if (step === "interview") {
    return (
      <InterviewRoom
        setup={setup}
        questions={questions}
        stream={stream}
        onFinish={finish}
        onCancel={leave}
      />
    );
  }

  // ------------------------------------------------
  // Main Application UI
  // ------------------------------------------------

  return (
    <div className="home">

      {/* Header */}

      {step !== "dashboard" && (
        <header>
          <div className="mark">
            Rehearsal<span>.</span>
          </div>

          <UserButton />
        </header>
      )}

      {/* Dashboard */}

      {step === "dashboard" && (
        <Dashboard
          onStartInterview={() => {
            setShowModal(true);
          }}
          sessions={completedSessions}
        />
      )}

      {/* Old Home */}

      {step === "home" && (
        <Home
          onStart={() => {
            setShowModal(true);
          }}
        />
      )}

      {/* Permissions */}

      {step === "permissions" && (
        <PermissionStep
          setup={setup}
          onBack={() => {
            setStep("dashboard");
          }}
          onGranted={startInterview}
        />
      )}

      {/* Loading */}

      {step === "loading" && (
        <main>
          <p className="eyebrow">
            {setup?.techStack} ·{" "}
            {levelText(setup?.experience)}
          </p>

          <h1>
            Preparing your interview…
          </h1>

          <p className="lede">
            Generating questions based on your
            experience and tech stack.
          </p>
        </main>
      )}

      {/* AI Evaluation */}

      {step === "evaluating" && (
        <main>
          <p className="eyebrow">
            Interview complete
          </p>

          <h1>
            Reviewing your performance…
          </h1>

          <p className="lede">
            AI is analyzing your answers and preparing
            your interview feedback.
          </p>
        </main>
      )}

      {/* Error */}

      {step === "error" && (
        <main>
          <h1>
            Something went wrong
          </h1>

          <p
            className="error"
            role="alert"
          >
            {questionError}
          </p>

          <div className="btn-row">
            <button
              className="btn-ghost"
              onClick={() => {
                setStep("dashboard");
              }}
            >
              Cancel
            </button>

            <button
              className="cta"
              onClick={() => {
                setStep("permissions");
              }}
            >
              Try again
            </button>
          </div>
        </main>
      )}

      {/* Finished */}

      {step === "finished" && (
        <main>
          <p className="eyebrow">
            Interview complete
          </p>

          <h1>
            Nice work.
          </h1>

          <p className="lede">
            You answered{" "}
            {
              finalAnswers.filter(
                (answer) => answer.answer?.trim()
              ).length
            }{" "}
            of{" "}
            {finalAnswers.length} questions.
          </p>

          {evaluation && (
            <div style={{ marginTop: "30px" }}>
              <h2>
                Overall Score: {evaluation.overallScore}/100
              </h2>

              {evaluation.strengths?.length > 0 && (
                <div style={{ marginTop: "20px" }}>
                  <h3>Strengths</h3>

                  <ul>
                    {evaluation.strengths.map(
                      (item, index) => (
                        <li key={index}>
                          {item}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}

              {evaluation.weaknesses?.length > 0 && (
                <div style={{ marginTop: "20px" }}>
                  <h3>Areas to Improve</h3>

                  <ul>
                    {evaluation.weaknesses.map(
                      (item, index) => (
                        <li key={index}>
                          {item}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}

              {evaluation.improvements?.length > 0 && (
                <div style={{ marginTop: "20px" }}>
                  <h3>Suggestions</h3>

                  <ul>
                    {evaluation.improvements.map(
                      (item, index) => (
                        <li key={index}>
                          {item}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          {evaluationError && (
            <p
              className="error"
              style={{ marginTop: "20px" }}
            >
              {evaluationError}
            </p>
          )}

          <button
            className="cta"
            style={{ marginTop: "30px" }}
            onClick={() => {
              setStep("dashboard");
            }}
          >
            Back to Dashboard
          </button>
        </main>
      )}

      {/* Interview Setup Modal */}

      {showModal && (
        <InterviewSetupModal
          onClose={() => {
            setShowModal(false);
          }}
          onStart={(data) => {
            setSetup(data);
            setShowModal(false);
            setStep("permissions");
          }}
        />
      )}
    </div>
  );
}

// --------------------------------------------------
// App
// --------------------------------------------------

export default function App() {
  return (
    <>
      <SignedOut>
        <AuthPage />
      </SignedOut>

      <SignedIn>
        <Signed />
      </SignedIn>
    </>
  );
}