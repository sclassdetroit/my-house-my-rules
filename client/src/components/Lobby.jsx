import { useState } from "react";
import RoomCode from "./RoomCode.jsx";

export default function Lobby({
  room,
  isHost,
  selectedPacks,
  onTogglePack,
  onImportPack,
  onStart,
  onHouseRule
}) {
  const [packText, setPackText] = useState("");
  const [showImporter, setShowImporter] = useState(false);
  const packs = room.availablePacks || [
    { id: "main", name: "Main Pack" },
    { id: "afterdark", name: "After Dark Pack" },
    { id: "couples", name: "Couples Pack" }
  ];

  function importPack() {
    onImportPack(packText);
    setPackText("");
    setShowImporter(false);
  }

  return (
    <main className="screen lobby-screen">
      <RoomCode code={room.roomCode} />
      <section className="panel">
        <img className="brand-logo small" src="/assets/brand/company-logo.png" alt="Game company logo" onError={(event) => event.currentTarget.remove()} />
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
            {packs.map((pack) => (
              <label className={`toggle ${pack.custom ? "premium-toggle" : ""}`} key={pack.id}>
                <input
                  type="checkbox"
                  checked={selectedPacks.includes(pack.id)}
                  onChange={() => onTogglePack(pack.id)}
                />
                <span>
                  {pack.name}
                  {pack.custom && <small> IMPORTED</small>}
                  {(pack.warning || pack.premium) && <small> 18+</small>}
                  <em>{pack.blackCards} black / {pack.whiteCards} white</em>
                </span>
              </label>
            ))}
          </div>
          <button className="secondary" type="button" onClick={() => setShowImporter((value) => !value)}>
            Import Custom Pack
          </button>
          {showImporter && (
            <div className="importer">
              <textarea
                value={packText}
                onChange={(event) => setPackText(event.target.value)}
                placeholder={"PACK NAME: Filthy Secrets Pack\nWARNING: 18+ ADULT CONTENT\n\nBLACK CARDS:\nYour prompt card here ____.\nAnother prompt here ____.\n\nWHITE CARDS:\nYour answer card here\nAnother answer card here"}
              />
              <p>Paste your private card list here. Use BLACK CARDS: and WHITE CARDS: headings, or paste JSON with name, warning, blackCards, and whiteCards.</p>
              <button type="button" onClick={importPack} disabled={!packText.trim()}>Add Pack To Room</button>
            </div>
          )}
          <button className="secondary" type="button" onClick={onHouseRule}>My House Rule</button>
          <button type="button" onClick={onStart}>Start Game</button>
        </section>
      )}
    </main>
  );
}
