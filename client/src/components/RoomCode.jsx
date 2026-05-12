export default function RoomCode({ code }) {
  if (!code) return null;
  return (
    <div className="room-code" aria-label="Room code">
      <span>Room</span>
      <strong>{code}</strong>
    </div>
  );
}
