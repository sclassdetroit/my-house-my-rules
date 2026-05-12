export default function WarningModal({ open, onAccept, onCancel }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal warning">
        <img src="/assets/cards/adult-warning-card.png" alt="" onError={(event) => event.currentTarget.remove()} />
        <h2>After Dark is 18+</h2>
        <p>This pack is made for adults. Confirm everyone playing is 18 or older.</p>
        <div className="modal-actions">
          <button className="ghost" type="button" onClick={onCancel}>Cancel</button>
          <button type="button" onClick={onAccept}>Confirm 18+</button>
        </div>
      </div>
    </div>
  );
}
