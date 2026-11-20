/**
 * Portal v2 shared class contracts (Figma "05 · 파트너 v2 디자인 시스템").
 *
 * v2 focus is the Figma "white 2 + blue 2" double ring: a solid blue ring with
 * an offset in the surface colour the control sits on. Blue (#2563eb) keeps at
 * least 3:1 against both the white surface and the navy sidebar.
 */
export const PV2_FOCUS_RING_CLASS_NAME =
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-pv2-blue focus-visible:ring-offset-2 focus-visible:ring-offset-pv2-surface";

/** Focus ring for controls placed on the navy sidebar or mobile drawer. */
export const PV2_FOCUS_RING_ON_SIDEBAR_CLASS_NAME =
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-pv2-blue focus-visible:ring-offset-2 focus-visible:ring-offset-pv2-sidebar";

/** hover/focus 120ms, ease-out cubic-bezier(0.2,0,0,1); reduced motion is handled globally. */
export const PV2_TRANSITION_CLASS_NAME =
  "transition-colors duration-120 ease-[cubic-bezier(0.2,0,0,1)]";
