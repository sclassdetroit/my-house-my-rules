export default function WarningModal({
  open,
  title = "After Dark is 18+",
  message = "This pack is made for adults. Confirm everyone playing is 18 or older.",
  confirmLabel = "Confirm 18+",
  onAccept,
  onCancel
}) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal warning">
        <img src="/assets/cards/adult-warning-card.png" alt="" onError={(event) => event.currentTarget.remove()} />
        <h2>{title}</h2>
        <p>{message}</p>
        <div className="modal-actions">
          <button className="ghost" type="button" onClick={onCancel}>Cancel</button>
          <button type="button" onClick={onAccept}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
