import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import AnswerCard from "./components/AnswerCard.jsx";
import Lobby from "./components/Lobby.jsx";
import PromptCard from "./components/PromptCard.jsx";
import RoomCode from "./components/RoomCode.jsx";
import RuleBanner from "./components/RuleBanner.jsx";
import Scoreboard from "./components/Scoreboard.jsx";
import TimerBar from "./components/TimerBar.jsx";
import WarningModal from "./components/WarningModal.jsx";
import WinnerModal from "./components/WinnerModal.jsx";

const socket = io(import.meta.env.VITE_SERVER_URL || "http://localhost:3001", {
  autoConnect: true,
  reconnection: true
});

export default function App() {
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [room, setRoom] = useState(null);
  const [playerId, setPlayerId] = useState(localStorage.getItem("mhhrPlayerId"));
  const [selectedCards, setSelectedCards] = useState([]);
  const [error, setError] = useState("");
  const [showWarning, setShowWarning] = useState(false);
  const [pendingPacks, setPendingPacks] = useState(null);
  const [pendingWarningPack, setPendingWarningPack] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(30);

  const me = room?.players.find((player) => player.id === playerId);
  const judgeId = room?.currentJudge?.id;
  const isJudge = playerId && judgeId === playerId;
  const isHost = Boolean(me?.isHost);
  const myHand = me?.hand || [];
  const requiredCards = room?.activeHouseRule?.id === "submit_two" ? 2 : 1;
  const hasSubmitted = room?.submissions.some((submission) => submission.playerId === playerId);

  useEffect(() => {
    const onRoom = (nextRoom) => {
      setRoom(nextRoom);
      setSelectedCards([]);
      setError("");
    };
    socket.on("roomUpdated", onRoom);
    return () => socket.off("roomUpdated", onRoom);
  }, []);

  useEffect(() => {
    const savedRoomCode = localStorage.getItem("mhhrRoomCode");
    const savedPlayerId = localStorage.getItem("mhhrPlayerId");
    if (!savedRoomCode || !savedPlayerId) return;
    socket.emit("reconnectPlayer", { roomCode: savedRoomCode, playerId: savedPlayerId }, (response) => {
      if (response?.ok) setRoom(response.room);
    });
  }, []);

  useEffect(() => {
    if (room?.activeHouseRule?.id !== "speed_round" || room.phase !== "playing") return;
    setSecondsLeft(30);
    const timer = setInterval(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [room?.roundNumber, room?.activeHouseRule?.id, room?.phase]);

  const selectedPacks = room?.selectedPacks || ["main"];
  const judgeReminder = useMemo(() => {
    if (room?.activeHouseRule?.id === "worst_answer") return "Pick the worst answer.";
    if (room?.activeHouseRule?.id === "reverse_winner") return "Least funny wins this round.";
    return "Pick the winning answer.";
  }, [room?.activeHouseRule]);

  function call(event, payload = {}) {
    socket.emit(event, payload, (response) => {
      if (!response?.ok) setError(response?.error || "Something went sideways.");
      if (response?.ok && response.playerId) {
        setPlayerId(response.playerId);
        localStorage.setItem("mhhrPlayerId", response.playerId);
        localStorage.setItem("mhhrRoomCode", response.room.roomCode);
      }
      if (response?.ok && response.room) setRoom(response.room);
    });
  }

  function createRoom() {
    if (!name.trim()) return setError("Enter a display name first.");
    call("createRoom", { name });
  }

  function joinRoom() {
    if (!name.trim()) return setError("Enter a display name first.");
    if (joinCode.trim().length < 5) return setError("Enter the 5-character room code.");
    call("joinRoom", { name, roomCode: joinCode });
  }

  function togglePack(pack) {
    const next = selectedPacks.includes(pack)
      ? selectedPacks.filter((item) => item !== pack)
      : [...selectedPacks, pack];
    const finalPacks = next.length ? next : ["main"];
    const packInfo = room?.availablePacks?.find((item) => item.id === pack);
    const warningPack = getWarningPack(pack, packInfo);
    const acceptedWarnings = JSON.parse(localStorage.getItem("mhhrAcceptedWarnings") || "{}");
    if (warningPack && finalPacks.includes(pack) && !selectedPacks.includes(pack) && !acceptedWarnings[warningPack.id]) {
      setPendingPacks(finalPacks);
      setPendingWarningPack(warningPack);
      setShowWarning(true);
      return;
    }
    call("selectPacks", { packs: finalPacks });
  }

  function acceptAfterDark() {
    if (pendingWarningPack?.id) {
      const acceptedWarnings = JSON.parse(localStorage.getItem("mhhrAcceptedWarnings") || "{}");
      localStorage.setItem("mhhrAcceptedWarnings", JSON.stringify({
        ...acceptedWarnings,
        [pendingWarningPack.id]: true
      }));
    }
    setShowWarning(false);
    call("selectPacks", { packs: pendingPacks || selectedPacks });
    setPendingWarningPack(null);
    setPendingPacks(null);
  }

  function getWarningPack(packId, packInfo) {
    if (packId === "afterdark") {
      return {
        id: "afterdark",
        title: "AFTER DARK IS 18+",
        message: "This pack is made for adults. Confirm everyone playing is 18 or older.",
        confirmLabel: "CONFIRM 18+"
      };
    }
    if (packInfo?.warning || packInfo?.premium) {
      return {
        id: packInfo.id,
        title: `${packInfo.name.toUpperCase()} IS 18+`,
        message: packInfo.warning || "This premium pack is intended for mature audiences only.",
        confirmLabel: packInfo.id === "filthysecrets" ? "ENTER THE CHAOS" : "CONFIRM 18+"
      };
    }
    return null;
  }

  function importCustomPack(packText) {
    call("importCustomPack", { packText });
  }

  function pickCard(cardId) {
    if (isJudge || room.phase !== "playing" || hasSubmitted) return;
    setSelectedCards((current) => {
      if (current.includes(cardId)) return current.filter((id) => id !== cardId);
      return [...current, cardId].slice(-requiredCards);
    });
  }

  function submit() {
    if (selectedCards.length !== requiredCards) {
      setError(`Select ${requiredCards} card${requiredCards > 1 ? "s" : ""}.`);
      return;
    }
    call("submitCard", { cardIds: selectedCards });
  }

  function newGame() {
    localStorage.removeItem("mhhrPlayerId");
    localStorage.removeItem("mhhrRoomCode");
    window.location.reload();
  }

  function leaveGame() {
    socket.emit("leaveRoom", {}, () => {
      localStorage.removeItem("mhhrPlayerId");
      localStorage.removeItem("mhhrRoomCode");
      setPlayerId(null);
      setRoom(null);
      setSelectedCards([]);
      setError("");
    });
  }

  if (!room) {
    return (
      <main className="screen landing">
        <section className="brand-lockup">
          <img className="brand-logo" src="/assets/brand/company-logo.png" alt="Game company logo" onError={(event) => event.currentTarget.remove()} />
          <p className="eyebrow">Adult party card game</p>
          <h1>My House My Rules</h1>
          <p>Play with friends in the same room or across tabs. Original cards, anonymous chaos, house rules.</p>
        </section>
        <section className="panel entry-panel">
          <label>
            Display name
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength={24} placeholder="Your table name" />
          </label>
          <button type="button" onClick={createRoom}>Create Room</button>
          <div className="join-row">
            <input value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} maxLength={5} placeholder="CODE" />
            <button type="button" onClick={joinRoom}>Join</button>
          </div>
          <p className="disclaimer">Some packs are made for adults. Keep it fun, consensual, and 18+ when After Dark is on.</p>
          {error && <p className="error">{error}</p>}
        </section>
      </main>
    );
  }

  if (room.phase === "lobby") {
    return (
      <>
        <Lobby
          room={room}
          isHost={isHost}
          selectedPacks={selectedPacks}
          onTogglePack={togglePack}
          onImportPack={importCustomPack}
          onStart={() => call("startGame")}
          onHouseRule={() => call("activateHouseRule")}
        />
        <WarningModal
          open={showWarning}
          title={pendingWarningPack?.title}
          message={pendingWarningPack?.message}
          confirmLabel={pendingWarningPack?.confirmLabel}
          onAccept={acceptAfterDark}
          onCancel={() => {
            setShowWarning(false);
            setPendingWarningPack(null);
            setPendingPacks(null);
          }}
        />
        {error && <div className="toast">{error}</div>}
      </>
    );
  }

  return (
    <main className="game-shell">
      <header className="game-top">
        <div className="top-actions">
          <img className="brand-logo mini" src="/assets/brand/company-logo.png" alt="Game company logo" onError={(event) => event.currentTarget.remove()} />
          <RoomCode code={room.roomCode} />
          <button className="exit-button" type="button" onClick={leaveGame}>Exit Game</button>
        </div>
        <Scoreboard players={room.players} judgeId={judgeId} />
      </header>

      <RuleBanner rule={room.activeHouseRule} />
      <TimerBar active={room.activeHouseRule?.id === "speed_round" && room.phase === "playing"} secondsLeft={secondsLeft} />

      <section className="round-info">
        <span>Round {room.roundNumber}</span>
        <strong>{room.currentJudge?.name} is judge</strong>
      </section>

      <section className="table">
        <PromptCard prompt={room.currentPrompt} />
      </section>

      {room.phase === "playing" && (
        <section className="hand-dock">
          {isJudge ? (
            <div className="judge-wait">You are judging. Let the room submit.</div>
          ) : (
            <>
              <div className="hand-scroll">
                {myHand.map((card) => (
                  <AnswerCard
                    key={card.id}
                    card={card}
                    selected={selectedCards.includes(card.id)}
                    onClick={() => pickCard(card.id)}
                  />
                ))}
              </div>
              <button type="button" disabled={hasSubmitted} onClick={submit}>
                {hasSubmitted ? "Submitted" : `Submit ${requiredCards > 1 ? "cards" : "card"}`}
              </button>
            </>
          )}
        </section>
      )}

      {room.phase === "judging" && (
        <section className="judge-panel">
          <p className="eyebrow">{isJudge ? judgeReminder : "Judge is choosing"}</p>
          <div className="submission-grid">
            {room.submissions.map((submission, index) => (
              <div className="submission" key={submission.id}>
                <span>Answer {index + 1}</span>
                <div className="submission-cards">
                  {submission.cards.map((card) => (
                    <AnswerCard key={card.id} card={card} />
                  ))}
                </div>
                {isJudge && <button type="button" onClick={() => call("pickWinner", { submissionId: submission.id })}>Pick winner</button>}
              </div>
            ))}
          </div>
        </section>
      )}

      {room.phase === "roundResult" && (
        <section className="result-panel">
          <p className="eyebrow">Round winner</p>
          <h2>{room.roundWinner?.playerName}</h2>
          <div className="submission-cards">
            {room.roundWinner?.submission.cards.map((card) => (
              <AnswerCard key={card.id} card={card} />
            ))}
          </div>
          {(isHost || isJudge) && <button type="button" onClick={() => call("nextRound")}>Next round</button>}
        </section>
      )}

      <WinnerModal winner={room.winner} players={room.players} onNewGame={newGame} />
      {isHost && room.phase === "playing" && (
        <div className="floating-host">
          <button className="secondary" type="button" onClick={() => call("activateHouseRule")}>My House Rule</button>
        </div>
      )}
      {error && <div className="toast">{error}</div>}
    </main>
  );
}
