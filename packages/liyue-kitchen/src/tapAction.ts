import type { MouseEvent, PointerEvent } from "react";

type Gesture = {
  key: string;
  pointerId: number;
  x: number;
  y: number;
  cancelled: boolean;
  active: boolean;
};

const TAP_SLOP_PX = 12;
const moved = (gesture: Gesture, e: PointerEvent<HTMLButtonElement>) =>
  Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y) > TAP_SLOP_PX;

/**
 * A touch pointer-up activates even when a preceding drag suppressed the
 * browser's compatibility click. Native mouse/pen and keyboard/AT clicks
 * continue to use onClick. State is scoped to the actual button, not a
 * coordinate/time window, so a fresh gesture never inherits a drag delay.
 */
export function createTapAction() {
  const touch = new WeakMap<HTMLButtonElement, Gesture>();
  const matching = (e: PointerEvent<HTMLButtonElement>) => {
    const gesture = touch.get(e.currentTarget);
    return e.pointerType === "touch" && gesture?.active &&
      gesture.pointerId === e.pointerId ? gesture : undefined;
  };
  const cancel = (e: PointerEvent<HTMLButtonElement>) => {
    const gesture = matching(e);
    if (gesture) {
      gesture.cancelled = true;
      gesture.active = false;
    }
  };
  return (key: string, action: () => void) => ({
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      const button = e.currentTarget;
      if (e.pointerType !== "touch") {
        // A genuine new mouse/pen gesture must not be blocked by a touch
        // whose browser never emitted a compatibility click.
        touch.delete(button);
        return;
      }
      if (!e.isPrimary) return;
      touch.set(button, { key, pointerId: e.pointerId, x: e.clientX, y: e.clientY,
        cancelled: button.disabled, active: true });
    },
    onPointerMove: (e: PointerEvent<HTMLButtonElement>) => {
      const gesture = matching(e);
      // Once dragged outside the slop, returning to the origin is not a tap.
      if (gesture && moved(gesture, e)) gesture.cancelled = true;
    },
    onPointerUp: (e: PointerEvent<HTMLButtonElement>) => {
      const gesture = matching(e);
      if (!gesture) return;
      gesture.active = false;
      const button = e.currentTarget;
      if (gesture.cancelled || gesture.key !== key || button.disabled || moved(gesture, e)) return;
      // Touch implicit capture retargets release to the original button even
      // when the finger has left it. Require a real hit on that button.
      const hit = button.ownerDocument.elementFromPoint(e.clientX, e.clientY);
      if (hit && button.contains(hit)) action();
    },
    onPointerCancel: cancel,
    onLostPointerCapture: cancel,
    onClick: (e: MouseEvent<HTMLButtonElement>) => {
      const button = e.currentTarget;
      if (button.disabled) return;
      const native = e.nativeEvent as globalThis.MouseEvent & {
        pointerType?: string;
        sourceCapabilities?: { firesTouchEvents?: boolean } | null;
      };
      // Modern browsers identify compatibility clicks; the per-button
      // gesture also covers MouseEvent-only implementations, including
      // cancelled/moved touches and a button reused for another action.
      if (native.pointerType === "touch" || native.sourceCapabilities?.firesTouchEvents) return;
      if (e.detail !== 0 && touch.has(button)) return;
      action();
    },
  });
}
