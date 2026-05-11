import React from "react";
import { Composition } from "remotion";

import { ElectionBroadcastComposition } from "./templates/ElectionBroadcastComposition.js";
import { createElectionBroadcastSampleProps } from "./sampleProps.js";

const sampleProps = createElectionBroadcastSampleProps();

export function RemotionRoot(): React.ReactElement {
  return (
    <Composition
      id="ElectionBroadcastReveal"
      component={ElectionBroadcastComposition}
      durationInFrames={sampleProps.video.totalFrames}
      fps={sampleProps.video.fps}
      width={sampleProps.video.resolution.width}
      height={sampleProps.video.resolution.height}
      defaultProps={sampleProps}
    />
  );
}
