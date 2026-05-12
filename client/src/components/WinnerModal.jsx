export default function WinnerModal({ winner, players, onNewGame }) {
  if (!winner) return null;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal winner-modal">
        <p className="eyebrow">House Champion</p>
        <h2>{winner.name} wins!</h2>
        <div className="final-scores">
          {players.map((player) => (
            <span key={player.id}>
              {player.name} <b>{player.score}</b>
            </span>
          ))}
        </div>
        <button type="button" onClick={onNewGame}>New game</button>
      </div>
    </div>
  );
}
