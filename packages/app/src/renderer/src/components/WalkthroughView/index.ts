export { WalkthroughView } from "./WalkthroughView";
export { FileDiffMinimap } from "./FileDiffMinimap";
export { FileMasonryCard } from "./FileMasonryCard";
export { MasonryGroups } from "./MasonryGroups";
export { FileOverlayPanel } from "./FileOverlayPanel";
export { WalkthroughStep } from "./WalkthroughStep";
export { FollowUpComposer } from "./FollowUpComposer";
export {
  parseInlineNodes,
  parseInlineRef,
  extractRelevantFiles,
  type InlineNode,
  type InlineRef,
  type RefNode,
  type TextNode,
} from "./inline-refs";
export {
  parsePatchForMinimap,
  overlapsRanges,
  type MinimapData,
  type MinimapSegment,
} from "./minimap-utils";
