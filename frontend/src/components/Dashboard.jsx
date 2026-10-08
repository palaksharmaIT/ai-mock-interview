import { useState } from "react";
import { useUser, UserButton } from "@clerk/clerk-react";
import "./Dashboard.css";

// --------------------------------------------------
// Get AI score out of 100
// --------------------------------------------------

function getScore(session) {
  if (typeof session.overallScore === "number") return session.overallScore;
  if (typeof session.rating === "number") return session.rating * 10;
  if (typeof session.finalRating === "number") return session.finalRating * 10;
  if (!session.totalQuestions) return 0;
  return (session.answeredQuestions / session.totalQuestions) * 100;
}

function scoreTone(score) {
  if (score >= 75) return "good";
  if (score >= 50) return "mid";
  return "low";
}

// --------------------------------------------------
// Format date
// --------------------------------------------------

function formatDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// --------------------------------------------------
// Score Trend Chart
// --------------------------------------------------

function TrendChart({ sessions }) {
  const scores = [...sessions].reverse().map(getScore);

  const W = 600;
  const H = 160;
  const pad = 20;
  const step = scores.length > 1 ? (W - pad * 2) / (scores.length - 1) : 0;

  const points = scores.map((score, i) => [
    pad + i * step,
    H - pad - (score / 100) * (H - pad * 2),
  ]);

  return (
    <svg className="trend-svg" viewBox={`0 0 ${W} ${H}`} role="img">
      {[0, 25, 50, 75, 100].map((tick) => {
        const y = H - pad - (tick / 100) * (H - pad * 2);
        return (
          <g key={tick}>
            <line x1={pad} x2={W - pad} y1={y} y2={y} className="trend-grid" />
            <text x={0} y={y + 4} className="trend-tick">
              {tick}
            </text>
          </g>
        );
      })}

      <polyline
        className="trend-line"
        points={points.map((p) => p.join(",")).join(" ")}
      />

      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="4" className="trend-dot" />
      ))}
    </svg>
  );
}

// --------------------------------------------------
// Small reusable pieces for the report
// --------------------------------------------------

function FeedbackPanel({ title, subtitle, items }) {
  return (
    <section className="panel feedback-panel">
      <div className="panel-header">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>

      <div className="panel-body">
        <ul className="feedback-list">
          {items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function QuestionFeedbackList({ items }) {
  const [open, setOpen] = useState(() => new Set());
  const allOpen = open.size === items.length;

  const toggle = (i) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const toggleAll = () =>
    setOpen(allOpen ? new Set() : new Set(items.map((_, i) => i)));

  return (
    <section>
      <div className="section-header">
        <div>
          <h2>Question-by-question feedback</h2>
          <p>Click a question to read the detailed analysis.</p>
        </div>

        <button className="practice-link" onClick={toggleAll}>
          {allOpen ? "Collapse all" : "Expand all"}
        </button>
      </div>

      <ul className="qf-list">
        {items.map((item, index) => {
          const isOpen = open.has(index);
          const tone = scoreTone(item.score);

          return (
            <li className="qf-item" key={index}>
              <button
                className="qf-row"
                onClick={() => toggle(index)}
                aria-expanded={isOpen}
              >
                <span className="qf-num">Q{item.questionNumber ?? index + 1}</span>

                <span className="qf-bar">
                  <span
                    className={`qf-bar-fill ${tone}`}
                    style={{ width: `${item.score}%` }}
                  />
                </span>

                <span className={`qf-score ${tone}`}>
                  {item.score}
                  <small>/100</small>
                </span>

                <span className="qf-chevron">{isOpen ? "−" : "+"}</span>
              </button>

              {isOpen && <p className="qf-feedback">{item.feedback}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// --------------------------------------------------
// AI Report
// --------------------------------------------------

function ReportView({ session, onBack }) {
  const evaluation = session?.evaluation || {};
  const score = getScore(session);

  const hasStrengths = evaluation.strengths?.length > 0;
  const hasWeaknesses = evaluation.weaknesses?.length > 0;
  const hasImprovements = evaluation.improvements?.length > 0;

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="dashboard-inner header-inner">
          <div className="dashboard-brand">
            <div className="brand-mark">R</div>
            <span>
              Rehearsal<span className="brand-dot">.</span>
            </span>
          </div>

          <div className="dashboard-user">
            <UserButton />
          </div>
        </div>
      </header>

      <main className="dashboard-inner dashboard-content report-content">
        <button
          className="practice-link report-back"
          onClick={onBack}
        >
          ← Back to sessions
        </button>

        {/* Report Header */}
        <section className="dashboard-hero">
          <div>
            <p className="dashboard-eyebrow">AI INTERVIEW REPORT</p>
            <h1>{session.techStack} Interview</h1>
            <p className="dashboard-subtitle">
              {session.experience}
              {" · "}
              {formatDate(session.completedAt || session.createdAt)}
            </p>
          </div>
        </section>

        {/* Score */}
        <section className="stats-grid">
          <div className="stat-card">
            <span className="stat-label">Overall score</span>
            <div className="stat-number">
              {score.toFixed(0)}
              <small>/100</small>
            </div>
            <p className="stat-help">AI evaluation</p>
          </div>

          <div className="stat-card">
            <span className="stat-label">Questions answered</span>
            <div className="stat-number">
              {session.answeredQuestions}
              <small>/{session.totalQuestions}</small>
            </div>
            <p className="stat-help">Interview completion</p>
          </div>

          <div className="stat-card">
            <span className="stat-label">Technical stack</span>
            <div className="stat-number stat-number-text">{session.techStack}</div>
            <p className="stat-help">Interview focus</p>
          </div>
        </section>

        {/* Strengths / Weaknesses / Improvements side by side */}
        {(hasStrengths || hasWeaknesses || hasImprovements) && (
          <div className="feedback-grid">
            {hasStrengths && (
              <FeedbackPanel
                title="Strengths"
                subtitle="What you did well."
                items={evaluation.strengths}
              />
            )}

            {hasWeaknesses && (
              <FeedbackPanel
                title="Areas to improve"
                subtitle="Where answers can be stronger."
                items={evaluation.weaknesses}
              />
            )}

            {hasImprovements && (
              <FeedbackPanel
                title="Recommended improvements"
                subtitle="Steps for your next interview."
                items={evaluation.improvements}
              />
            )}
          </div>
        )}

        {/* Question Feedback */}
        {evaluation.questionFeedback?.length > 0 && (
          <QuestionFeedbackList items={evaluation.questionFeedback} />
        )}
      </main>
    </div>
  );
}

// --------------------------------------------------
// Dashboard
// --------------------------------------------------

function Dashboard({ onStartInterview, sessions = [] }) {
  const { user } = useUser();
  const [selectedSession, setSelectedSession] = useState(null);

  if (selectedSession) {
    return (
      <ReportView
        session={selectedSession}
        onBack={() => setSelectedSession(null)}
      />
    );
  }

  // Stats
  const completedSessions = sessions.length;

  const totalQuestions = sessions.reduce(
    (total, s) => total + (s.totalQuestions || 0),
    0
  );

  const answeredQuestions = sessions.reduce(
    (total, s) => total + (s.answeredQuestions || 0),
    0
  );

  const answerRate = totalQuestions
    ? Math.round((answeredQuestions / totalQuestions) * 100)
    : 0;

  const avgScore = completedSessions
    ? (
        sessions.reduce((total, s) => total + getScore(s), 0) /
        completedSessions
      ).toFixed(0)
    : "–";

  const recentSessions = sessions.slice(0, 5);

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="dashboard-inner header-inner">
          <div className="dashboard-brand">
            <div className="brand-mark">R</div>
            <span>
              Rehearsal<span className="brand-dot">.</span>
            </span>
          </div>

          <div className="dashboard-user">
            <div className="user-info">
              <strong>{user?.fullName || user?.firstName || "User"}</strong>
              <span>{user?.primaryEmailAddress?.emailAddress || ""}</span>
            </div>
            <UserButton />
          </div>
        </div>
      </header>

      <main className="dashboard-inner dashboard-content">
        {/* Hero */}
        <section className="dashboard-hero">
          <div>
            <p className="dashboard-eyebrow">CANDIDATE WORKSPACE</p>
            <h1>Welcome back, {user?.firstName || "there"}.</h1>
            <p className="dashboard-subtitle">
              Track your progress, review feedback, and run practice sessions.
            </p>
          </div>

          <button className="dashboard-primary-btn" onClick={onStartInterview}>
            <span className="plus-icon">+</span>
            Start New Interview
          </button>
        </section>

        {/* Stats */}
        <section className="stats-grid">
          <div className="stat-card">
            <span className="stat-label">Sessions completed</span>
            <div className="stat-number">{completedSessions}</div>
            <p className="stat-help">Practice interviews finished</p>
          </div>

          <div className="stat-card">
            <span className="stat-label">Average score</span>
            <div className="stat-number">
              {avgScore}
              {completedSessions > 0 && <small>/100</small>}
            </div>
            <p className="stat-help">Across all sessions</p>
          </div>

          <div className="stat-card">
            <span className="stat-label">Answer rate</span>
            <div className="stat-number">
              {answerRate}
              <small>%</small>
            </div>
            <p className="stat-help">
              {answeredQuestions} of {totalQuestions} questions answered
            </p>
          </div>
        </section>

        {/* Trend */}
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Score trend</h2>
              <p>How your AI scores change from session to session</p>
            </div>
          </div>

          <div className="panel-body">
            {completedSessions === 0 ? (
              <div className="empty-state">
                <h3>No interview data yet</h3>
                <p>Complete your first interview to start tracking progress.</p>
                <button className="chart-start-btn" onClick={onStartInterview}>
                  Start your first interview
                </button>
              </div>
            ) : completedSessions === 1 ? (
              <div className="empty-state">
                <h3>Your trend starts with the next session</h3>
                <p>Complete one more interview to see how you're improving.</p>
              </div>
            ) : (
              <TrendChart sessions={recentSessions} />
            )}
          </div>
        </section>

        {/* Past Sessions */}
        <section>
          <div className="section-header">
            <div>
              <h2>Past sessions</h2>
              <p>Review your completed technical interviews</p>
            </div>

            <button className="practice-link" onClick={onStartInterview}>
              + Practice another role
            </button>
          </div>

          {recentSessions.length === 0 ? (
            <div className="panel empty-state">
              <h3>No interviews completed yet</h3>
              <p>Your completed interviews and AI feedback will appear here.</p>
            </div>
          ) : (
            <ul className="sessions-list">
              {recentSessions.map((session) => {
                const date = formatDate(session.completedAt || session.createdAt);
                const score = getScore(session);

                return (
                  <li className="session-row" key={session.id}>
                    <div className="session-avatar">
                      {(session.techStack || "?").charAt(0).toUpperCase()}
                    </div>

                    <div className="session-main">
                      <strong>{session.techStack}</strong>
                      <span>
                        {session.experience}
                        {date ? ` · ${date}` : ""}
                      </span>
                    </div>

                    <div className="session-meta">
                      <span className="session-score">
                        {score.toFixed(0)}
                        <small>/100</small>
                      </span>
                      <span className="session-answered">
                        {session.answeredQuestions}/{session.totalQuestions} answered
                      </span>
                    </div>

                    <button
                      className="session-report-btn"
                      onClick={() => setSelectedSession(session)}
                    >
                      View Report
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

export default Dashboard;