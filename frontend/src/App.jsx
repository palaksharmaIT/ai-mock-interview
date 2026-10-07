import { useState } from "react";
import { checkBackend } from "./api";
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
import "./App.css";

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
        <div className="tabs">
          <button
            className={mode === "signin" ? "on" : ""}
            onClick={() => setMode("signin")}
          >
            Sign in
          </button>

          <button
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
            <SignIn />
          </>
        ) : (
          <>
            <h2>Create your account.</h2>
            <p className="sub">Start preparing for your next interview.</p>
            <SignUp />
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

      <p className="lede">
        Practice your technical interview with AI.
      </p>

      <button className="cta" onClick={onStart}>
        Start Interview
      </button>
    </main>
  );
}

function Signed() {
  const [step, setStep] = useState("home");
  const [showModal, setShowModal] = useState(false);
  const [setup, setSetup] = useState(null);
  const [stream, setStream] = useState(null);
  const testBackend = async () => {
  try {
    const data = await checkBackend();
    console.log("Backend response:", data);
  } catch (error) {
    console.error("Backend connection failed:", error);
  }
};

  const leave = () => {
    stream?.getTracks().forEach((track) => track.stop());
    setStream(null);
    setStep("home");
  };

  return (
    <div className="home">
      <header>
        <div className="mark">
          Rehearsal<span>.</span>
        </div>

        <UserButton />
      </header>

    {step === "home" && (
      <main>
        <Home onStart={() => setShowModal(true)} />

        <button className="btn-ghost" onClick={testBackend}>
          Test Backend
        </button>
      </main>
    )}

      {step === "permissions" && (
        <PermissionStep
          setup={setup}
          onBack={() => setStep("home")}
          onGranted={(s) => {
            setStream(s);
            setStep("interview");
          }}
        />
      )}

      {step === "interview" && (
        <main>
          <p className="eyebrow">
            {setup?.techStack} · {setup?.experience}
          </p>

          <h1>Camera and mic are ready.</h1>

          <p className="lede">
            Step 3 — the AI interview questions will come here.
          </p>

          <button className="btn-ghost" onClick={leave}>
            Cancel
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