import { useEffect, useMemo, useRef, useState } from "react";
import useProctoring from "../hooks/useProctoring";
import "./proctoring.css";

const TOTAL_SECONDS = 30 * 60; // whole interview
const LOW_TIME_SECONDS = 5 * 60; // timer turns rust under this
const SUGGESTED_MINUTES = 3; // guidance per question
const MAX_WARNINGS = 3; // popups shown to the candidate
const MAX_SCREENSHOTS = 12; // saved per interview

const WARNING_TEXT = {
  no_face: "We can't see your face. Please stay in the frame.",
  multiple_faces: "More than one person is visible. Please sit alone.",
  looking_away: "Please look at the screen while you answer.",
  camera_blocked: "Your camera looks blocked or too dark. Please uncover it.",
};

const STATUS_TEXT = {
  loading: "Starting integrity check…",
  ready: "Integrity check on",
  error: "Integrity check unavailable",
};

// Small JPEG snapshot of the camera, or null if the video isn't ready
function captureFrame(video) {
  if (!video || !video.videoWidth) return null;
  const width = 320;
  const height = Math.round((video.videoHeight / video.videoWidth) * width);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(video, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.6);
}

const mmss = (s) => {
  const t = Math.max(0, s);
  const m = Math.floor(t / 60);
  const r = t % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
};

const levelLabel = (exp) => (exp === "Fresher" ? "Fresher" : `${exp} yrs`);

export default function InterviewRoom({ setup, questions, stream, onFinish, onCancel }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState(() => questions.map(() => ""));
  const [now, setNow] = useState(() => Date.now());
  const [listening, setListening] = useState(false);
  const [warningCount, setWarningCount] = useState(0);
  const [toast, setToast] = useState(null);

  const startedAt = useRef(Date.now());
  const questionStartedAt = useRef(Date.now());
  const videoRef = useRef(null);
  const recogRef = useRef(null);
  const finishedRef = useRef(false);
  const eventsRef = useRef([]); // every flag, with its screenshot
  const warningsRef = useRef(0);
  const screenshotsRef = useRef(0);
  const toastTimerRef = useRef(null);
  const statusRef = useRef("loading");
  const indexRef = useRef(0);
  const answersRef = useRef(answers);
  indexRef.current = index;
  answersRef.current = answers;

  const speechSupported = useMemo(
    () => typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition),
    []
  );
  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;

  // ---- Integrity check ----
  const handleFlag = (flag) => {
    // Screenshot (limited number per interview)
    let screenshot = null;
    if (screenshotsRef.current < MAX_SCREENSHOTS) {
      screenshot = captureFrame(videoRef.current);
      if (screenshot) screenshotsRef.current += 1;
    }

    // Warning popup (only the first MAX_WARNINGS flags)
    let warningNumber = null;
    if (warningsRef.current < MAX_WARNINGS) {
      warningsRef.current += 1;
      warningNumber = warningsRef.current;
      setWarningCount(warningNumber);
      setToast({ number: warningNumber, text: WARNING_TEXT[flag.type] });

      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setToast(null), 7000);
    }

    eventsRef.current.push({
      ...flag,
      question: indexRef.current + 1,
      warningNumber,
      screenshot,
    });
  };

  const { status: proctorStatus, current: proctorCurrent } = useProctoring({
    videoRef,
    stream,
    enabled: true,
    onFlag: handleFlag,
  });

  useEffect(() => {
    statusRef.current = proctorStatus;
  }, [proctorStatus]);

  useEffect(() => () => clearTimeout(toastTimerRef.current), []);


  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const elapsed = Math.floor((now - startedAt.current) / 1000);
  const left = TOTAL_SECONDS - elapsed;
  const qElapsed = Math.floor((now - questionStartedAt.current) / 1000);
  const low = left <= LOW_TIME_SECONDS;

  // Camera preview
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  // Speech-to-text (Chrome, Edge, Safari). Other browsers just type.
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.continuous = true;
    r.interimResults = false;
    r.lang = "en-US";
    r.onresult = (e) => {
      let text = "";
      for (let k = e.resultIndex; k < e.results.length; k++) {
        if (e.results[k].isFinal) text += e.results[k][0].transcript + " ";
      }
      if (!text) return;
      setAnswers((prev) =>
        prev.map((v, i) => (i === indexRef.current ? `${v} ${text}`.trim() : v))
      );
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recogRef.current = r;
    return () => {
      try { r.stop(); } catch {}
      window.speechSynthesis?.cancel();
    };
  }, []);

  const stopListening = () => {
    try { recogRef.current?.stop(); } catch {}
    setListening(false);
  };

  const toggleMic = () => {
    if (listening) return stopListening();
    try {
      recogRef.current?.start();
      setListening(true);
    } catch {}
  };

  const readAloud = () => {
    if (!canSpeak) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(questions[index]));
  };

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    stopListening();
    window.speechSynthesis?.cancel();
    onFinish(
      questions.map((question, i) => ({ question, answer: answersRef.current[i].trim() })),
      {
        monitoring: statusRef.current, // "ready" means the check really ran
        warningCount: warningsRef.current,
        events: eventsRef.current,
      }
    );
  };

  // Out of time: submit whatever has been answered
  useEffect(() => {
    if (left <= 0) finish();
  }, [left]);

  const next = () => {
    stopListening();
    window.speechSynthesis?.cancel();
    if (index < questions.length - 1) {
      setIndex(index + 1);
      questionStartedAt.current = Date.now();
      setNow(Date.now());
    } else {
      finish();
    }
  };

  const cancel = () => {
    if (window.confirm("End this interview? Your answers won't be saved.")) {
      stopListening();
      window.speechSynthesis?.cancel();
      onCancel();
    }
  };

  const isLast = index === questions.length - 1;

  return (
    <div className="room">
      <header className="room-bar">
        <div className="mark">Rehearsal<span>.</span></div>
        <div className="room-meta">{setup.techStack} · {levelLabel(setup.experience)}</div>
        <div className={`proctor-chip ${proctorStatus}`}>
          <i className="proctor-dot" />
          <span>
            {STATUS_TEXT[proctorStatus]}
            {proctorStatus === "ready" && ` · Warnings ${warningCount}/${MAX_WARNINGS}`}
          </span>
        </div>
        <div className={`timer ${low ? "low" : ""}`} role="timer">
          <span className="timer-label">{low ? "Time running low" : "Time remaining"}</span>
          <span className="timer-value">{mmss(left)}</span>
        </div>
      </header>

      <main className="room-main">
        <div className="q-wrap">
          <div
            className="q-progress"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={questions.length}
            aria-valuenow={index + 1}
            aria-label={`Question ${index + 1} of ${questions.length}`}
          >
            {questions.map((_, i) => (
              <span key={i} className={i < index ? "done" : i === index ? "now" : ""} />
            ))}
          </div>

          <article className="q-card">
            <div className="q-head">
              <span>Question {index + 1} of {questions.length}</span>
              <span>This question {mmss(qElapsed)} · aim for about {SUGGESTED_MINUTES} min</span>
            </div>

            <h1 className="q-text">{questions[index]}</h1>

            <label htmlFor="answer" className="sr-only">Your answer</label>
            <textarea
              id="answer"
              value={answers[index]}
              onChange={(e) =>
                setAnswers((prev) => prev.map((v, i) => (i === index ? e.target.value : v)))
              }
              placeholder={
                speechSupported
                  ? "Record your answer out loud, or type it here. You can edit the transcript."
                  : "Type your answer here."
              }
            />

            <div className="q-actions">
              <div className="tools">
                {speechSupported && (
                  <button
                    type="button"
                    className={`btn-ghost sm ${listening ? "rec" : ""}`}
                    onClick={toggleMic}
                    aria-pressed={listening}
                  >
                    {listening ? <><i className="rec-dot" /> Stop recording</> : "Record answer"}
                  </button>
                )}
                {canSpeak && (
                  <button type="button" className="btn-ghost sm" onClick={readAloud}>
                    Read aloud
                  </button>
                )}
              </div>
              <button type="button" className="cta" onClick={next}>
                {isLast ? "Finish interview" : "Next question"}
              </button>
            </div>
          </article>

          <button type="button" className="end-link" onClick={cancel}>End interview</button>
        </div>
      </main>

      {toast && (
        <div className={`proctor-toast ${toast.number === MAX_WARNINGS ? "final" : ""}`} role="alert">
          <strong>
            {toast.number === MAX_WARNINGS
              ? "Final warning"
              : `Warning ${toast.number} of ${MAX_WARNINGS}`}
          </strong>
          <span>{toast.text}</span>
          {toast.number === MAX_WARNINGS && (
            <span>Any further flags will be recorded in your report.</span>
          )}
        </div>
      )}

      <div className={`pip ${proctorCurrent ? "flagged" : ""}`}>
        <video ref={videoRef} autoPlay muted playsInline />
        <span>{proctorCurrent ? "Check your position" : "You"}</span>
      </div>
    </div>
  );
}