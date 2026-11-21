import {
  WALK_SPEEDS,
  type WalkingCamera,
  type WalkProgress,
  type WalkSpeed,
} from "../walk/walkingCamera";

interface WalkControlsProps {
  /** Null until the 3D city is ready. */
  camera: WalkingCamera | null;
  progress: WalkProgress | null;
}

/** Whether "next" goes to another stop rather than the gate. */
function nextIsStop(progress: WalkProgress | null): boolean {
  if (!progress) return true;
  const target = progress.phase === "at_stop" ? progress.stopIndex + 1 : progress.stopIndex;
  return target < progress.stopCount;
}

/** Start, pause, next stop and speed, so the walk works without the agent. */
export function WalkControls({ camera, progress }: WalkControlsProps) {
  const phase = progress?.phase;
  const disabled = !camera || !progress;
  const started = phase !== undefined && phase !== "idle" && phase !== "done";
  const paused = phase === "paused";

  return (
    <div className="walk-controls" role="group" aria-label="Walk controls">
      {!started ? (
        <button
          type="button"
          className="primary"
          disabled={disabled}
          onClick={() => camera?.start()}
        >
          {phase === "done" ? "Walk again" : "Start walk"}
        </button>
      ) : (
        <button
          type="button"
          className="primary"
          onClick={() => {
            if (paused) camera?.resume();
            else camera?.pause();
          }}
        >
          {paused ? "Resume" : "Pause"}
        </button>
      )}
      <button type="button" disabled={!started} onClick={() => camera?.nextStop()}>
        {nextIsStop(progress) ? "Next stop" : "To the gate"}
      </button>
      <label className="walk-speed">
        Speed
        <select
          value={progress?.speed ?? 1}
          disabled={disabled}
          onChange={(e) => camera?.setSpeed(Number(e.target.value) as WalkSpeed)}
        >
          {WALK_SPEEDS.map((s) => (
            <option key={s} value={s}>
              {s}×
            </option>
          ))}
        </select>
      </label>
      {disabled && <p className="muted walk-hint">The walk starts once the 3D city is ready.</p>}
    </div>
  );
}
