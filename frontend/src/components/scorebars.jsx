import "./ScoreBars.css";

function shortDate(value) {
  const d = new Date(value);
  if (!value || Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ScoreBars({ sessions, getScore, max = 100 }) {
  // oldest -> newest, last 6 only
  const items = [...sessions].slice(0, 6).reverse();
  const scores = items.map(getScore);

  const latest = scores[scores.length - 1];
  const previous = scores.length > 1 ? scores[scores.length - 2] : null;
  const delta = previous === null ? null : Math.round(latest - previous);

  return (
    <div className="sb">
      <div className="sb-summary">
        <div>
          <span className="sb-label">Latest score</span>
          <div className="sb-big">
            {Math.round(latest)}
            <small>/{max}</small>
          </div>
        </div>

        {delta !== null && (
          <span
            className={`sb-delta ${delta >= 0 ? "up" : "down"}`}
          >
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)} vs previous
          </span>
        )}
      </div>

      <div className="sb-chart">
        <div className="sb-grid">
          <span>{max}</span>
          <span>{max / 2}</span>
          <span>0</span>
        </div>

        <div className="sb-cols">
          {items.map((s, i) => {
            const score = scores[i];
            const isLatest = i === items.length - 1;
            const pct = Math.max((score / max) * 100, 2);

            return (
              <div className="sb-col" key={s.id ?? i}>
                <div className="sb-track">
                  <span className="sb-value">{Math.round(score)}</span>
                  <div
                    className={`sb-bar ${isLatest ? "latest" : ""}`}
                    style={{ height: `${pct}%` }}
                  />
                </div>
                <strong className="sb-name">{s.techStack}</strong>
                <span className="sb-date">{shortDate(s.createdAt)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default ScoreBars;