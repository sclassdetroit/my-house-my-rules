import RoomCode from "./RoomCode.jsx";

const packLabels = {
  main: "Main Pack",
  afterdark: "After Dark Pack",
  couples: "Couples Pack"
};

export default function Lobby({
  room,
  isHost,
  selectedPacks,
  onTogglePack,
  onStart,
  onHouseRule
}) {
  return (
    <main className="screen lobby-screen">
      <RoomCode code={room.roomCode} />
      <section className="panel">
        <p className="eyebrow">Lobby</p>
        <h1>My House My Rules</h1>
        <div className="player-list">
          {room.players.map((player) => (
            <div className="player-row" key={player.id}>
              <span className={`dot ${player.connected ? "online" : "offline"}`} />
              <strong>{player.name}</strong>
              {player.isHost && <small>HOST</small>}
            </div>
          ))}
        </div>
      </section>
      {isHost && (
        <section className="host-controls">
          <div className="pack-grid">
            {Object.entries(packLabels).map(([id, label]) => (
              <label className="toggle" key={id}>
                <input
                  type="checkbox"
                  checked={selectedPacks.includes(id)}
                  onChange={() => onTogglePack(id)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <button className="secondary" type="button" onClick={onHouseRule}>My House Rule</button>
          <button type="button" onClick={onStart}>Start Game</button>
        </section>
      )}
    </main>
  );
}
