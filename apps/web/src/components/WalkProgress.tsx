import type { RouteData } from "@mamsha/shared";

import { announceProgress, describeProgress } from "../walk/progressText";
import type { WalkProgress as Progress } from "../walk/walkingCamera";

interface WalkProgressProps {
  progress: Progress;
  route: RouteData;
}

export function WalkProgress({ progress, route }: WalkProgressProps) {
  const walked = progress.length - progress.remaining;
  return (
    <div className="walk-progress">
      <p className="walk-progress-text">{describeProgress(progress, route)}</p>
      <progress
        max={progress.length}
        value={Math.max(0, walked)}
        aria-label={`Walked ${Math.max(0, walked)} of ${progress.length} metres`}
      />
      <p role="status" className="visually-hidden">
        {announceProgress(progress, route)}
      </p>
    </div>
  );
}
