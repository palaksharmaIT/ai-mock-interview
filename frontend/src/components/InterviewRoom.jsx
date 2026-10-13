import { useEffect, useMemo, useRef, useState } from "react";
import useProctoring from "../hooks/useProctoring";
import "./proctoring.css";

const TOTAL_SECONDS = 30 * 60;
const LOW_TIME_SECONDS = 5 * 60;
const SUGGESTED_MINUTES = 3;
const MAX_WARNINGS = 3;

const WARNING_TEXT = {
  no_face: "We can't see your face. Please stay in the frame.",
  multiple_faces: "More than one face is visible. Please ensure you are alone.",
  looking_away: "You've been looking away for too long. Please look at the screen.",
  camera_blocked: "Your camera appears blocked or too dark. Please check it.",
};

const STATUS_TEXT = {
  loading: "Starting integrity check…",
  ready: "Integrity check on",
  error: "Integrity check unavailable",
};

const mmss = (seconds) => {
  const t = Math.max(0, seconds);
  const minutes = Math.floor(t / 60);
  const remainder = t % 60;

  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
};

const levelLabel = (experience) =>
  experience === "Fresher" ? "Fresher" : `${experience} yrs`;

const getDraftKey = (setup) =>
  `rehearsal_draft_${encodeURIComponent(setup.techStack)}_${encodeURIComponent(setup.experience)}`;

const readDraft = (key) => {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return null;

    const draft = JSON.parse(saved);

    if (!Array.isArray(draft.questions) || draft.questions.length === 0) {
      return null;
    }

    return draft;
  } catch {
    return null;
  }
};

export default function InterviewRoom({
  setup,
  questions,
  stream,
  onFinish,
  onCancel,
}) {
  const draftKey = getDraftKey(setup);

  const [draft] = useState(() => readDraft(draftKey));

  const [activeQuestions] = useState(() =>
    draft?.questions?.length ? draft.questions : questions
  );

  const [index, setIndex] = useState(() => {
    if (!draft) return 0;

    return Math.min(
      Math.max(Number(draft.index) || 0, 0),
      Math.max((draft.questions?.length || 1) - 1, 0)
    );
  });

  const [answers, setAnswers] = useState(() => {
    const savedAnswers = Array.isArray(draft?.answers)
      ? draft.answers
      : [];

    return activeQuestions.map((_, i) => savedAnswers[i] || "");
  });

  const [now, setNow] = useState(() => Date.now());
  const [listening, setListening] = useState(false);
  const [warningCount, setWarningCount] = useState(0);
  const [toast, setToast] = useState(null);
  const [terminationMessage, setTerminationMessage] = useState("");
  const [draftSaved, setDraftSaved] = useState(false);

  const startedAt = useRef(Date.now());
  const questionStartedAt = useRef(Date.now());
  const videoRef = useRef(null);
  const recogRef = useRef(null);
  const finishedRef = useRef(false);
  const eventsRef = useRef([]);
  const warningsRef = useRef(0);
  const toastTimerRef = useRef(null);
  const terminationTimerRef = useRef(null);
  const statusRef = useRef("loading");
  const indexRef = useRef(index);
  const answersRef = useRef(answers);
  const stopStreamRef = useRef(false);

  indexRef.current = index;
  answersRef.current = answers;

  const speechSupported = useMemo(
    () =>
      typeof window !== "undefined" &&
      !!(window.SpeechRecognition || window.webkitSpeechRecognition),
    []
  );

  const canSpeak =
    typeof window !== "undefined" &&
    "speechSynthesis" in window;

  const stopMedia = () => {
    if (stopStreamRef.current) return;
    stopStreamRef.current = true;

    try {
      recogRef.current?.stop();
    } catch {
      // Recognition may already have stopped.
    }

    setListening(false);

    if (typeof window !== "undefined") {
      window.speechSynthesis?.cancel();
    }

    stream?.getTracks().forEach((track) => track.stop());
  };

  const submitInterview = (reason = "completed") => {
    if (finishedRef.current) return;

    finishedRef.current = true;
    stopMedia();

    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    if (terminationTimerRef.current) {
      clearTimeout(terminationTimerRef.current);
    }

    // The interview is submitted, so its draft is no longer needed.
    try {
      localStorage.removeItem(draftKey);
    } catch (error) {
      console.warn("Could not remove interview draft:", error);
    }

    const finalAnswers = activeQuestions.map((question, i) => ({
      question,
      answer: (answersRef.current[i] || "").trim(),
    }));

    onFinish(finalAnswers, {
      monitoring: statusRef.current,
      warningCount: warningsRef.current,
      events: eventsRef.current,
      terminationReason: reason,
      terminatedForViolations: reason === "violation_limit_reached",
    });
  };

  // -----------------------------------------------
  // Save draft and resume later
  // -----------------------------------------------

  const saveAndExit = () => {
    if (finishedRef.current || shouldTerminate) return;

    stopListening();

    if (typeof window !== "undefined") {
      window.speechSynthesis?.cancel();
    }

    const draftData = {
      setup,
      questions: activeQuestions,
      answers: answersRef.current,
      index: indexRef.current,
      savedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(draftKey, JSON.stringify(draftData));
      setDraftSaved(true);
    } catch (error) {
      console.error("Could not save interview draft:", error);
      setToast({
        number: null,
        text: "Unable to save your draft. Check your browser storage.",
      });
      return;
    }

    stopMedia();

    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    // Return to the previous screen without submitting the interview.
    onCancel();
  };

  // -----------------------------------------------
  // Proctoring events
  // -----------------------------------------------

  const handleFlag = (flag) => {
    if (finishedRef.current) return;

    const warningNumber =
      flag.violationNumber || warningsRef.current + 1;

    warningsRef.current = warningNumber;
    setWarningCount(warningNumber);

    eventsRef.current.push({
      ...flag,
      question: indexRef.current + 1,
      warningNumber,
    });

    setToast({
      number: warningNumber,
      text:
        WARNING_TEXT[flag.type] ||
        "A proctoring violation has been detected.",
    });

    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 6000);
  };

  const handleTerminate = (event) => {
    if (finishedRef.current) return;

    const reason =
      event?.reason || "Maximum violation limit reached";

    setTerminationMessage(
      "The interview has ended because the maximum number of proctoring violations was reached."
    );

    setToast({
      number: MAX_WARNINGS,
      text: reason,
    });

    if (terminationTimerRef.current) {
      clearTimeout(terminationTimerRef.current);
    }

    terminationTimerRef.current = setTimeout(() => {
      submitInterview("violation_limit_reached");
    }, 1800);
  };

  const {
    status: proctorStatus,
    current: proctorCurrent,
    shouldTerminate,
  } = useProctoring({
    videoRef,
    stream,
    enabled: !finishedRef.current,
    onFlag: handleFlag,
    onTerminate: handleTerminate,
  });

  useEffect(() => {
    statusRef.current = proctorStatus;
  }, [proctorStatus]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }

      if (terminationTimerRef.current) {
        clearTimeout(terminationTimerRef.current);
      }
    };
  }, []);

  // -----------------------------------------------
  // Timer
  // -----------------------------------------------

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const elapsed = Math.floor((now - startedAt.current) / 1000);
  const left = TOTAL_SECONDS - elapsed;

  const qElapsed = Math.floor(
    (now - questionStartedAt.current) / 1000
  );

  const low = left <= LOW_TIME_SECONDS;

  // -----------------------------------------------
  // Camera preview
  // -----------------------------------------------

  useEffect(() => {
    const video = videoRef.current;

    if (!video) return;

    video.srcObject = stream || null;

    if (stream) {
      video.play().catch(() => {
        // Browser may require a user gesture.
      });
    }

    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  // -----------------------------------------------
  // Speech recognition
  // -----------------------------------------------

  useEffect(() => {
    if (typeof window === "undefined") return;

    const Recognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!Recognition) return;

    const recognition = new Recognition();

    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let transcript = "";

      for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
      ) {
        if (event.results[i].isFinal) {
          transcript += `${event.results[i][0].transcript} `;
        }
      }

      if (!transcript || finishedRef.current) return;

      setAnswers((previous) =>
        previous.map((answer, i) =>
          i === indexRef.current
            ? `${answer} ${transcript}`.trim()
            : answer
        )
      );
    };

    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recogRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch {
        // Recognition may already have stopped.
      }

      window.speechSynthesis?.cancel();
    };
  }, []);

  const stopListening = () => {
    try {
      recogRef.current?.stop();
    } catch {
      // Recognition may already have stopped.
    }

    setListening(false);
  };

  const toggleMic = () => {
    if (finishedRef.current || controlsDisabled) return;

    if (listening) {
      stopListening();
      return;
    }

    try {
      recogRef.current?.start();
      setListening(true);
    } catch (error) {
      console.warn("Speech recognition could not start:", error);
    }
  };

const readAloud = () => {
  if (finishedRef.current || controlsDisabled) {
    console.log("Read aloud disabled");
    return;
  }

  const question = activeQuestions[index];

  if (!question) {
    console.error("No question found at index:", index);
    return;
  }

  const questionText =
    typeof question === "string"
      ? question
      : question.question || question.text || "";

  if (!questionText.trim()) {
    console.error("Question text is empty:", question);
    return;
  }

  if (!("speechSynthesis" in window)) {
    alert("Your browser does not support text-to-speech.");
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(questionText);
  utterance.lang = "en-US";
  utterance.rate = 0.9;

  utterance.onstart = () => console.log("Reading question aloud");
  utterance.onerror = (event) => {
    console.error("Speech error:", event.error);
  };

  window.speechSynthesis.speak(utterance);
};

  // -----------------------------------------------
  // Automatic termination
  // -----------------------------------------------

  useEffect(() => {
    if (left <= 0 && !finishedRef.current) {
      submitInterview("time_limit_reached");
    }
  }, [left]);

  useEffect(() => {
    if (shouldTerminate && !terminationMessage) {
      setTerminationMessage(
        "The interview is ending because the violation limit was reached."
      );
    }
  }, [shouldTerminate, terminationMessage]);

  // -----------------------------------------------
  // Navigation
  // -----------------------------------------------

  const previous = () => {
    if (finishedRef.current || shouldTerminate || index <= 0) return;

    stopListening();
    window.speechSynthesis?.cancel();

    setIndex((current) => current - 1);
    questionStartedAt.current = Date.now();
    setNow(Date.now());
    setDraftSaved(false);
  };

  const next = () => {
    if (finishedRef.current || shouldTerminate) return;

    stopListening();
    window.speechSynthesis?.cancel();

    if (index < activeQuestions.length - 1) {
      setIndex((current) => current + 1);
      questionStartedAt.current = Date.now();
      setNow(Date.now());
      setDraftSaved(false);
    } else {
      submitInterview("completed");
    }
  };

  const cancel = () => {
    if (finishedRef.current || shouldTerminate) return;

    if (
      window.confirm(
        "End this interview? Your answers will not be saved."
      )
    ) {
      finishedRef.current = true;
      stopMedia();

      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }

      onCancel();
    }
  };

  const isLast = index === activeQuestions.length - 1;

  const controlsDisabled =
    Boolean(terminationMessage) ||
    shouldTerminate ||
    finishedRef.current;

  return (
    <div className="room">
      <header className="room-bar">
        <div className="mark">
          Rehearsal<span>.</span>
        </div>

        <div className="room-meta">
          {setup.techStack} · {levelLabel(setup.experience)}
        </div>

        <div className={`proctor-chip ${proctorStatus}`}>
          <i className="proctor-dot" />

          <span>
            {STATUS_TEXT[proctorStatus]}
            {proctorStatus === "ready" &&
              ` · Warnings ${warningCount}/${MAX_WARNINGS}`}
          </span>
        </div>

        <div className={`timer ${low ? "low" : ""}`} role="timer">
          <span className="timer-label">
            {low ? "Time running low" : "Time remaining"}
          </span>

          <span className="timer-value">{mmss(left)}</span>
        </div>
      </header>

      <main className="room-main">
        <div className="q-wrap">
          <div
            className="q-progress"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={activeQuestions.length}
            aria-valuenow={index + 1}
            aria-label={`Question ${index + 1} of ${activeQuestions.length}`}
          >
            {activeQuestions.map((_, i) => (
              <span
                key={i}
                className={
                  i < index ? "done" : i === index ? "now" : ""
                }
              />
            ))}
          </div>

          <article className="q-card">
            <div className="q-head">
              <span>
                Question {index + 1} of {activeQuestions.length}
              </span>

              <span>
                This question {mmss(qElapsed)} · aim for about{" "}
                {SUGGESTED_MINUTES} min
              </span>
            </div>

            <h1 className="q-text">{activeQuestions[index]}</h1>

            <label htmlFor="answer" className="sr-only">
              Your answer
            </label>

            <textarea
              id="answer"
              value={answers[index] || ""}
              disabled={controlsDisabled}
              onChange={(event) => {
                setAnswers((previousAnswers) =>
                  previousAnswers.map((answer, i) =>
                    i === index ? event.target.value : answer
                  )
                );
                setDraftSaved(false);
              }}
              placeholder={
                speechSupported
                  ? "Answer aloud or type here. You can edit the transcript."
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
                    disabled={controlsDisabled}
                    aria-pressed={listening}
                  >
                    {listening ? (
                      <>
                        <i className="rec-dot" /> Stop recording
                      </>
                    ) : (
                      "Record answer"
                    )}
                  </button>
                )}

                {canSpeak && (
                  <button
                    type="button"
                    className="btn-ghost sm"
                    onClick={readAloud}
                    disabled={controlsDisabled}
                  >
                    Read aloud
                  </button>
                )}
              </div>

              <div
                className="navigation-buttons"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: "10px",
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  className="btn-ghost sm"
                  onClick={previous}
                  disabled={index === 0 || controlsDisabled}
                >
                  ← Previous Question
                </button>

                <button
                  type="button"
                  className="cta"
                  onClick={next}
                  disabled={controlsDisabled}
                >
                  {isLast ? "Finish Interview" : "Next Question →"}
                </button>
              </div>
            </div>
          </article>

          <div
            className="interview-footer"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              flexWrap: "wrap",
              marginTop: "16px",
            }}
          >
            <button
              type="button"
              className="btn-ghost sm"
              onClick={saveAndExit}
              disabled={controlsDisabled}
            >
              Save & Exit
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {draftSaved && (
                <span role="status" style={{ fontSize: "13px" }}>
                  Draft saved
                </span>
              )}

              {!terminationMessage && (
                <button
                  type="button"
                  className="end-link"
                  onClick={cancel}
                  disabled={controlsDisabled}
                >
                  Discard interview
                </button>
              )}
            </div>
          </div>
        </div>
      </main>

      {toast && (
        <div className="proctor-toast final" role="alert">
          <strong>
            {terminationMessage
              ? "Interview ending"
              : toast.number
                ? `Warning ${toast.number} of ${MAX_WARNINGS}`
                : "Notice"}
          </strong>

          <span>{toast.text}</span>

          {terminationMessage && (
            <span>
              Your answers are being submitted for evaluation.
            </span>
          )}
        </div>
      )}

      <div className={`pip ${proctorCurrent ? "flagged" : ""}`}>
        <video ref={videoRef} autoPlay muted playsInline />

        <span>
          {proctorCurrent ? "Check your position" : "You"}
        </span>
      </div>
    </div>
  );
}