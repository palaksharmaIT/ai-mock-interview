import { useUser, UserButton } from "@clerk/clerk-react";
import "./Dashboard.css";

function Dashboard({ onStartInterview }) {
  const { user } = useUser();

  // Temporary data.
  // Later these values will come from the backend/database.
  const stats = {
    completedSessions: 0,
    averageScore: 0,
    highestScore: 0,
  };

  const recentSessions = [];

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="dashboard-brand">
          <div className="brand-mark">R</div>

          <span>
            Rehearsal<span className="brand-dot">.</span>
          </span>
        </div>

        <div className="dashboard-user">
          <div className="user-info">
            <strong>
              {user?.fullName || user?.firstName || "User"}
            </strong>

            <span>
              {user?.primaryEmailAddress?.emailAddress || ""}
            </span>
          </div>

          <UserButton />
        </div>
      </header>

      {/* Main */}
      <main className="dashboard-content">
        {/* Welcome Section */}
        <section className="dashboard-hero">
          <div>
            <p className="dashboard-eyebrow">
              CANDIDATE WORKSPACE
            </p>

            <h1>
              Welcome back,{" "}
              {user?.firstName || "there"}.
            </h1>

            <p className="dashboard-subtitle">
              Track your technical interview progress, review
              feedback breakdowns, and run practice sessions.
            </p>
          </div>

          <button
            className="dashboard-primary-btn"
            onClick={onStartInterview}
          >
            <span className="plus-icon">+</span>
            Start New Interview
          </button>
        </section>

        {/* Stats */}
        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-card-top">
              <span>Completed Sessions</span>

              <div className="stat-icon">
                ✓
              </div>
            </div>

            <div className="stat-number">
              {stats.completedSessions}
            </div>

            <p>
              Your completed practice interviews
            </p>
          </div>

          <div className="stat-card">
            <div className="stat-card-top">
              <span>Average Assessment Score</span>

              <div className="stat-icon">
                ↗
              </div>
            </div>

            <div className="stat-number">
              {stats.averageScore}
              <small>/100</small>
            </div>

            <p>
              Your average interview performance
            </p>
          </div>

          <div className="stat-card">
            <div className="stat-card-top">
              <span>Highest Score</span>

              <div className="stat-icon">
                ◷
              </div>
            </div>

            <div className="stat-number">
              {stats.highestScore}
              <small>/100</small>
            </div>

            <p>
              Your best interview performance
            </p>
          </div>
        </section>

        {/* Score Trajectory */}
        <section className="trajectory-card">
          <div className="trajectory-header">
            <div>
              <h2>Score Trajectory</h2>

              <p>
                Performance trend across your recent technical
                sessions
              </p>
            </div>

            <span className="recent-score">
              Recent: <strong>—</strong>
            </span>
          </div>

          <div className="chart-wrapper">
            {stats.completedSessions === 0 ? (
              <div className="empty-chart">
                <div className="empty-chart-icon">
                  ↗
                </div>

                <h3>No interview data yet</h3>

                <p>
                  Complete your first interview to start tracking
                  your performance.
                </p>

                <button
                  className="chart-start-btn"
                  onClick={onStartInterview}
                >
                  Start your first interview
                </button>
              </div>
            ) : (
              <div className="chart">
                {/* Future dynamic chart */}
              </div>
            )}
          </div>
        </section>

        {/* Past Sessions */}
        <section className="sessions-section">
          <div className="sessions-header">
            <div>
              <h2>Past Interview Sessions</h2>

              <p>
                Detailed logs of all completed technical
                evaluations
              </p>
            </div>

            <button
              className="practice-link"
              onClick={onStartInterview}
            >
              + Practice another role
            </button>
          </div>

          {recentSessions.length === 0 ? (
            <div className="empty-sessions">
              <div className="empty-sessions-icon">
                ◌
              </div>

              <h3>No interviews completed yet</h3>

              <p>
                Your completed interviews and AI feedback will
                appear here.
              </p>

              <button
                className="dashboard-primary-btn"
                onClick={onStartInterview}
              >
                Start New Interview
              </button>
            </div>
          ) : (
            <div className="sessions-list">
              {recentSessions.map((session) => (
                <div
                  className="session-row"
                  key={session.id}
                >
                  <div>
                    <strong>{session.techStack}</strong>
                    <span>{session.experience}</span>
                  </div>

                  <div className="session-score">
                    {session.score}/100
                  </div>

                  <span className="session-arrow">
                    →
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default Dashboard;