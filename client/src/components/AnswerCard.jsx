import Card from "./Card.jsx";

export default function AnswerCard({ card, selected, onClick }) {
  return <Card type="answer" text={card?.text || ""} selected={selected} onClick={onClick} />;
}
