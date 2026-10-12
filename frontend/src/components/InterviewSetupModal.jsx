
import { useEffect, useState } from "react";
import "./InterviewSetupModal.css";

const experiences = [
  {
    value: "Fresher",
    title: "Fresher",
    subtitle: "Starting my career",
  },
  {
    value: "1-2",
    title: "1–2 years",
    subtitle: "Early career",
  },
  {
    value: "3-5",
    title: "3–5 years",
    subtitle: "Growing experience",
  },
  {
    value: "5+",
    title: "5+ years",
    subtitle: "Experienced",
  },
];

const techStacks = [
  "Python",
  "Django",
  "FastAPI",
  "React",
  "JavaScript",
  "Java",
  "Node.js",
];

function InterviewSetupModal({ onClose, onStart }) {
  const [experience, setExperience] = useState("");
  const [techStack, setTechStack] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  // Close modal when Escape is pressed.
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const handleExperienceSelect = (value) => {
    setExperience(value);
    setError("");
  };

  const handleTechStackSelect = (value) => {
    setTechStack(value);
    setError("");
  };

  const handleStart = (event) => {
    event.preventDefault();

    if (!experience || !techStack) {
      setError(
        "Please select your experience level and tech stack."
      );
      return;
    }

    onStart({ experience, techStack });
  };

  const filteredStacks = techStacks.filter((stack) =>
    stack.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div
      className="overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <form
        className="modal setup-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="setup-title"
        onSubmit={handleStart}
      >
        {/* Header */}
        <div className="setup-heading">
          <span className="setup-eyebrow">
            YOUR NEXT STEP
          </span>

          <h2 id="setup-title">
            Set up your interview
          </h2>

          <p className="modal-sub">
            A little context helps us tailor your practice.
          </p>
        </div>

        {/* Experience selection */}
        <section className="setup-section">
          <div className="section-heading">
            <span className="section-number">01</span>

            <div>
              <h3>Experience level</h3>
              <p>Where are you in your career?</p>
            </div>
          </div>

          <div className="experience-grid">
            {experiences.map((item) => {
              const isSelected = experience === item.value;

              return (
                <button
                  key={item.value}
                  type="button"
                  className={`experience-card ${
                    isSelected ? "selected" : ""
                  }`}
                  aria-pressed={isSelected}
                  onClick={() =>
                    handleExperienceSelect(item.value)
                  }
                >
                  <span className="experience-title">
                    {item.title}
                  </span>

                  <span className="experience-subtitle">
                    {item.subtitle}
                  </span>

                  <span
                    className="selection-mark"
                    aria-hidden="true"
                  >
                    {isSelected ? "✓" : "+"}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Tech stack selection */}
        <section className="setup-section">
          <div className="section-heading">
            <span className="section-number">02</span>

            <div>
              <h3>Choose your tech stack</h3>
              <p>What would you like to practice?</p>
            </div>
          </div>

          <div className="stack-search">
            <span aria-hidden="true">⌕</span>

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search technologies..."
              aria-label="Search technologies"
            />
          </div>

          <div className="stack-grid">
            {filteredStacks.map((stack) => {
              const isSelected = techStack === stack;

              return (
                <button
                  key={stack}
                  type="button"
                  className={`stack-card ${
                    isSelected ? "selected" : ""
                  }`}
                  aria-pressed={isSelected}
                  onClick={() =>
                    handleTechStackSelect(stack)
                  }
                >
                  <span className="stack-dot" />

                  <span>{stack}</span>

                  {isSelected && (
                    <span
                      className="stack-check"
                      aria-hidden="true"
                    >
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {filteredStacks.length === 0 && (
            <p className="no-stacks">
              No matching technology. Try another search.
            </p>
          )}
        </section>

        {/* Validation message */}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="setup-footer">
          <button
            type="button"
            className="btn-ghost"
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="cta setup-continue"
            disabled={!experience || !techStack}
          >
            Continue <span aria-hidden="true">→</span>
          </button>
        </div>
      </form>
    </div>
  );
}

export default InterviewSetupModal;
