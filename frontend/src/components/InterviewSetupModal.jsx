import { useEffect, useState } from "react";

function InterviewSetupModal({ onClose, onStart }) {
  const [experience, setExperience] = useState("");
  const [techStack, setTechStack] = useState("");
  const [error, setError] = useState("");

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleStart = (e) => {
    e.preventDefault();
    if (!experience || !techStack) {
      setError("Choose your experience and your tech stack to continue.");
      return;
    }
    onStart({ experience, techStack });
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="setup-title"
        onSubmit={handleStart}
      >
        <h2 id="setup-title">Set up your interview</h2>
        <p className="modal-sub">Questions will be matched to what you pick here.</p>

        <div className="field">
          <label htmlFor="exp">Years of experience</label>
          <select
            id="exp"
            autoFocus
            value={experience}
            onChange={(e) => { setExperience(e.target.value); setError(""); }}
          >
            <option value="">Select experience</option>
            <option value="Fresher">Fresher</option>
            <option value="1-2">1-2 years</option>
            <option value="3-5">3-5 years</option>
            <option value="5+">5+ years</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="stack">Tech stack</label>
          <select
            id="stack"
            value={techStack}
            onChange={(e) => { setTechStack(e.target.value); setError(""); }}
          >
            <option value="">Select tech stack</option>
            <option value="Python">Python</option>
            <option value="Django">Django</option>
            <option value="FastAPI">FastAPI</option>
            <option value="React">React</option>
            <option value="JavaScript">JavaScript</option>
            <option value="Java">Java</option>
            <option value="Node.js">Node.js</option>
          </select>
        </div>

        {error && <p className="error" role="alert">{error}</p>}

        <div className="btn-row">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="cta">Continue</button>
        </div>
      </form>
    </div>
  );
}

export default InterviewSetupModal;