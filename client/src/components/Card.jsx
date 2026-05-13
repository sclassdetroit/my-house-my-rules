const fallbackLabels = {
  prompt: "My House My Rules",
  answer: "My House My Rules",
  hidden: "My House My Rules"
};

export default function Card({ type = "answer", text, selected = false, hidden = false, onClick, children }) {
  const kind = hidden ? "hidden" : type;
  const src = hidden
    ? "/assets/cards/black-logo-card.jpg"
    : type === "prompt"
      ? "/assets/cards/blank-black-card.jpg"
      : "/assets/cards/blank-white-card.jpg";

  return (
    <button
      className={`card card-${kind} ${selected ? "selected" : ""}`}
      onClick={onClick}
      type="button"
      disabled={!onClick}
      aria-pressed={selected}
    >
      <img
        src={src}
        alt=""
        onError={(event) => {
          const fallback = type === "answer"
            ? "/assets/cards/placeholder-white-card.svg"
            : "/assets/cards/placeholder-black-card.svg";
          if (event.currentTarget.src.endsWith(fallback)) {
            event.currentTarget.classList.add("missing");
            return;
          }
          event.currentTarget.src = fallback;
        }}
      />
      <span className="card-fallback">{fallbackLabels[kind]}</span>
      {!hidden && <span className="card-text">{text}</span>}
      {children}
    </button>
  );
}
