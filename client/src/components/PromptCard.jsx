import Card from "./Card.jsx";

export default function PromptCard({ prompt }) {
  return <Card type="prompt" text={prompt?.text || "Waiting for the next house prompt..."} />;
}
