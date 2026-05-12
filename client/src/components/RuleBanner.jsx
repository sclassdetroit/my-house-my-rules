export default function RuleBanner({ rule }) {
  if (!rule) return null;
  return (
    <div className="rule-banner">
      <strong>{rule.title}</strong>
      <span>{rule.description}</span>
    </div>
  );
}
