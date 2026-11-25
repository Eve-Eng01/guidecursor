import type { Align, Placement, PlacementOption } from "./types";

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}
export interface Size {
  width: number;
  height: number;
}
export interface PositionOptions {
  placement?: PlacementOption;
  align?: Align;
  /** Gap between reference and floating element. */
  offset?: number;
  /** Minimum distance from the viewport edges. */
  padding?: number;
}
export interface PositionResult {
  x: number;
  y: number;
  placement: Placement | "center";
}

const OPPOSITE: Record<Placement, Placement> = { top: "bottom", bottom: "top", left: "right", right: "left" };
const AUTO_ORDER: Placement[] = ["bottom", "top", "right", "left"];

function space(side: Placement, ref: Rect, viewport: Size): number {
  switch (side) {
    case "top":
      return ref.top;
    case "bottom":
      return viewport.height - (ref.top + ref.height);
    case "left":
      return ref.left;
    case "right":
      return viewport.width - (ref.left + ref.width);
  }
}

function fits(side: Placement, ref: Rect, floating: Size, viewport: Size, offset: number, padding: number): boolean {
  const need = side === "top" || side === "bottom" ? floating.height : floating.width;
  return space(side, ref, viewport) >= need + offset + padding;
}

function coords(side: Placement, align: Align, ref: Rect, floating: Size, offset: number): { x: number; y: number } {
  const alignOn = (start: number, refSize: number, floatSize: number): number => {
    if (align === "start") return start;
    if (align === "end") return start + refSize - floatSize;
    return start + refSize / 2 - floatSize / 2;
  };
  switch (side) {
    case "top":
      return { x: alignOn(ref.left, ref.width, floating.width), y: ref.top - floating.height - offset };
    case "bottom":
      return { x: alignOn(ref.left, ref.width, floating.width), y: ref.top + ref.height + offset };
    case "left":
      return { x: ref.left - floating.width - offset, y: alignOn(ref.top, ref.height, floating.height) };
    case "right":
      return { x: ref.left + ref.width + offset, y: alignOn(ref.top, ref.height, floating.height) };
  }
}

function clamp(value: number, min: number, max: number): number {
  return max < min ? min : Math.min(Math.max(value, min), max);
}

/**
 * Pure positioning: picks a side that fits (flipping when needed), aligns along it, then
 * shifts the result so it stays inside the viewport. `ref === null` centers the element.
 */
export function computePosition(
  ref: Rect | null,
  floating: Size,
  viewport: Size,
  options: PositionOptions = {},
): PositionResult {
  const { placement = "auto", align = "center", offset = 14, padding = 8 } = options;
  if (!ref) {
    return {
      x: clamp((viewport.width - floating.width) / 2, padding, viewport.width - floating.width - padding),
      y: clamp((viewport.height - floating.height) / 2, padding, viewport.height - floating.height - padding),
      placement: "center",
    };
  }

  const order: Placement[] =
    placement === "auto"
      ? AUTO_ORDER
      : [placement, OPPOSITE[placement], ...AUTO_ORDER.filter((p) => p !== placement && p !== OPPOSITE[placement])];
  let side = order.find((p) => fits(p, ref, floating, viewport, offset, padding));
  if (!side) {
    // Nothing fits: use the side with the most room.
    side = [...order].sort((a, b) => space(b, ref, viewport) - space(a, ref, viewport))[0] as Placement;
  }

  const { x, y } = coords(side, align, ref, floating, offset);
  return {
    x: clamp(x, padding, viewport.width - floating.width - padding),
    y: clamp(y, padding, viewport.height - floating.height - padding),
    placement: side,
  };
}

export function isInViewport(rect: Rect, viewport: Size, margin = 0): boolean {
  return (
    rect.top >= margin &&
    rect.left >= margin &&
    rect.top + rect.height <= viewport.height - margin &&
    rect.left + rect.width <= viewport.width - margin
  );
}
