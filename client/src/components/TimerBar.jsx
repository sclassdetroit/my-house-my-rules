export default function TimerBar({ active, secondsLeft }) {
  if (!active) return null;
  const percent = Math.max(0, Math.min(100, (secondsLeft / 30) * 100));
  return (
    <div className="timer" aria-label={`${secondsLeft} seconds left`}>
      <span style={{ width: `${percent}%` }} />
      <b>{secondsLeft}s</b>
    </div>
  );
}
