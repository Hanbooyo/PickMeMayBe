import type {
  ElectionBroadcastRenderProps,
  RenderAsset,
} from "../../../packages/render-types/src/index.js";

export type PreviewFrame = {
  frame: number;
  second: number;
  activeEventType: string;
};

export type RendererPreviewModel = {
  title: string;
  totalFrames: number;
  fps: number;
  resolution: {
    width: number;
    height: number;
  };
  winnerIds: string[];
  assets: RenderAsset[];
  keyFrames: PreviewFrame[];
};

export function createRendererPreviewModel(
  props: ElectionBroadcastRenderProps,
): RendererPreviewModel {
  return {
    title: props.scenario.title,
    totalFrames: props.video.totalFrames,
    fps: props.video.fps,
    resolution: props.video.resolution,
    winnerIds: props.scenario.winnerIds,
    assets: props.assets,
    keyFrames: props.scenario.timeline.map((event) => {
      const frame = Math.round(event.startSecond * props.video.fps);

      return {
        frame,
        second: event.startSecond,
        activeEventType: event.type,
      };
    }),
  };
}

export function getActiveTimelineEvent(
  props: ElectionBroadcastRenderProps,
  frame: number,
): string | undefined {
  const second = frame / props.video.fps;
  const activeEvent = props.scenario.timeline.find(
    (event) => second >= event.startSecond && second < event.endSecond,
  );

  return activeEvent?.type;
}
