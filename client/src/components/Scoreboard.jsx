export default function Scoreboard({ players = [], judgeId }) {
  return (
    <section className="scoreboard" aria-label="Scoreboard">
      {players.map((player) => (
        <div className={`score-pill ${player.id === judgeId ? "judge" : ""}`} key={player.id}>
          <span className={`dot ${player.connected ? "online" : "offline"}`} />
          <strong>{player.name}</strong>
          <b>{player.score}</b>
          {player.isHost && <small>HOST</small>}
          {player.id === judgeId && <small>JUDGE</small>}
        </div>
      ))}
    </section>
  );
}
