import { useState } from "react";
import { generateQuestions } from "./api";
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

// Makes Clerk's forms blend into the panel instead of showing a second card
const appearance = {
  variables: {
    colorPrimary: "#b4452a",
    colorText: "#1d1b17",
    colorBackground: "transparent",
    fontFamily: "'Instrument Sans', system-ui, sans-serif",
    borderRadius: "3px",
  },
  elements: {
    rootBox: { width: "100%" },
    cardBox: { width: "100%", boxShadow: "none" },
    card: { boxShadow: "none", background: "transparent", border: "none", padding: 0 },
    header: { display: "none" },
    footerAction: { display: "none" },
  },
};

const levelText = (exp) => (exp === "Fresher" ? "Fresher" : `${exp} years`);

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
              <p>Choose your experience level and tech stack.</p>
            </div>
          </li>

          <li>
            <span className="n">02</span>
            <div>
              <strong>Practice naturally</strong>
              <p>Answer questions using your camera and microphone.</p>
            </div>
          </li>

          <li>
            <span className="n">03</span>
            <div>
              <strong>Get feedback</strong>
              <p>Review your performance and identify areas to improve.</p>
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
            <p className="sub">Continue your interview practice.</p>
            <SignIn routing="hash" appearance={appearance} />
          </>
        ) : (
          <>
            <h2>Create your account.</h2>
            <p className="sub">Start preparing for your next interview.</p>
            <SignUp routing="hash" appearance={appearance} />
          </>
        )}
      </section>
    </div>
  );
}

function Home({ onStart }) {
  const { user } = useUser();

  return (
    <main>
      <p className="eyebrow">
        {user?.firstName ? `Hello, ${user.firstName}` : "Hello"}
      </p>

      <h1>Ready for your mock interview?</h1>

      <p className="lede">Practice your technical interview with AI.</p>

      <ul className="facts">
        <li>10 questions</li>
        <li>About 30 minutes</li>
        <li>Camera and mic</li>
      </ul>

      <button className="cta" onClick={onStart}>
        Start Interview
      </button>
    </main>
  );
}

function Signed() {
  const [step, setStep] = useState("dashboard");
  const [showModal, setShowModal] = useState(false);
  const [setup, setSetup] = useState(null);
  const [stream, setStream] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [finalAnswers, setFinalAnswers] = useState([]);
  const [questionError, setQuestionError] = useState("");

  const stopStream = (s = stream) => s?.getTracks().forEach((t) => t.stop());

  // Called once camera + mic are allowed
  const startInterview = async (cameraStream) => {
    setStep("loading");
    setQuestionError("");
    try {
      const data = await generateQuestions(setup.experience, setup.techStack);
      setQuestions(data.questions);
      setStream(cameraStream);
      setStep("interview");
    } catch (error) {
      console.error("Question generation failed:", error);
      stopStream(cameraStream); // don't leave the camera light on
      setQuestionError("Unable to generate interview questions. Please try again.");
      setStep("error");
    }
  };

  const leave = () => {
    stopStream();
    setStream(null);
    setQuestions([]);
    setFinalAnswers([]);
    setQuestionError("");
    setStep("home");
  };

  const finish = (answers) => {
    stopStream();
    setStream(null);
    setFinalAnswers(answers);
    console.log("Answers for feedback:", answers); // next step: send to FastAPI
    setStep("finished");
  };

  // The interview room is full-screen and has its own header + timer
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

  return (
    <div className="home">
      <header>
        <div className="mark">
          Rehearsal<span>.</span>
        </div>

        <UserButton />
      </header>

      {step === "home" && <Home onStart={() => setShowModal(true)} />}

      {step === "permissions" && (
        <PermissionStep
          setup={setup}
          onBack={() => setStep("home")}
          onGranted={startInterview}
        />
      )}

      {step === "loading" && (
        <main>
          <p className="eyebrow">
            {setup?.techStack} · {levelText(setup?.experience)}
          </p>
          <h1>Preparing your interview…</h1>
          <p className="lede">
            Generating questions based on your experience and tech stack.
          </p>
        </main>
      )}

      {step === "error" && (
        <main>
          <h1>Something went wrong</h1>
          <p className="error" role="alert">
            {questionError}
          </p>
          <div className="btn-row">
            <button className="btn-ghost" onClick={leave}>
              Cancel
            </button>
            <button className="cta" onClick={() => setStep("permissions")}>
              Try again
            </button>
          </div>
        </main>
      )}

      {step === "finished" && (
        <main>
          <p className="eyebrow">Interview complete</p>
          <h1>Nice work.</h1>
          <p className="lede">
            You answered {finalAnswers.filter((a) => a.answer).length} of{" "}
            {finalAnswers.length} questions. Your feedback report comes next.
          </p>
          <button className="cta" onClick={leave}>
            Back to home
          </button>
        </main>
      )}

      {showModal && (
        <InterviewSetupModal
          onClose={() => setShowModal(false)}
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