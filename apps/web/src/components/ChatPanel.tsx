/** The conversation side. Voice and captions are wired in later; captions are always on. */
export function ChatPanel() {
  return (
    <section className="panel chat-panel" aria-labelledby="conversation-heading">
      <h2 id="conversation-heading">Conversation</h2>
      <div className="captions" role="log" aria-live="polite" aria-label="Captions">
        <p className="muted">Your guide&apos;s words will appear here as captions.</p>
      </div>
    </section>
  );
}
