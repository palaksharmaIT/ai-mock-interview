import { useEffect, useMemo, useRef, useState } from "react";

const TOTAL_SECONDS = 30 * 60; // whole interview
const LOW_TIME_SECONDS = 5 * 60; // timer turns rust under this
const SUGGESTED_MINUTES = 3; // guidance per question

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

  const startedAt = useRef(Date.now());
  const questionStartedAt = useRef(Date.now());
  const videoRef = useRef(null);
  const recogRef = useRef(null);
  const finishedRef = useRef(false);
  const indexRef = useRef(0);
  const answersRef = useRef(answers);
  indexRef.current = index;
  answersRef.current = answers;

  const speechSupported = useMemo(
    () => typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition),
    []
  );
  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;


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
      questions.map((question, i) => ({ question, answer: answersRef.current[i].trim() }))
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

      <div className="pip">
        <video ref={videoRef} autoPlay muted playsInline />
        <span>You</span>
      </div>
    </div>
  );
}