import { AOI_CLIENT_CONFIG } from "../config";

export type ClientOrientation = "portrait" | "landscape";

export type ClientPreset = {
  name: string;
  deviceMemory: number;
  orientation: ClientOrientation;
  lookSens: number;
  lookLerp: number;
  cameraDistance: number;
  joystickRadius: number;
  joystickDeadzone: number;
  maxDevicePixelRatio: number;
  renderBudget: {
    nearDistance: number;
    midDistance: number;
    farDistance: number;
  };
};

function getDeviceMemory() {
  if (typeof navigator === "undefined") return 4;
  const value = Number((navigator as any).deviceMemory ?? 4);
  return Number.isFinite(value) && value > 0 ? value : 4;
}

function getOrientation(): ClientOrientation {
  if (typeof window === "undefined") return "landscape";
  if (window.matchMedia?.("(orientation: portrait)")?.matches) {
    return "portrait";
  }
  if (typeof screen !== "undefined" && screen.orientation?.type) {
    return String(screen.orientation.type).includes("portrait") ? "portrait" : "landscape";
  }
  return window.innerHeight > window.innerWidth ? "portrait" : "landscape";
}

export function resolveClientPreset(): ClientPreset {
  const deviceMemory = getDeviceMemory();
  const orientation = getOrientation();
  const lowMemory = deviceMemory <= 2;
  const midMemory = deviceMemory <= 4;
  const portrait = orientation === "portrait";

  if (lowMemory && portrait) {
    return {
      name: "mobile-low-portrait",
      deviceMemory,
      orientation,
      lookSens: 0.00265,
      lookLerp: 14,
      cameraDistance: 5.0,
      joystickRadius: 60,
      joystickDeadzone: 8,
      maxDevicePixelRatio: 1.35,
      renderBudget: {
        nearDistance: 14,
        midDistance: 28,
        farDistance: AOI_CLIENT_CONFIG.maxRenderDistance,
      },
    };
  }

  if (lowMemory) {
    return {
      name: "mobile-low-landscape",
      deviceMemory,
      orientation,
      lookSens: 0.0029,
      lookLerp: 15,
      cameraDistance: 5.15,
      joystickRadius: 64,
      joystickDeadzone: 7,
      maxDevicePixelRatio: 1.45,
      renderBudget: {
        nearDistance: 16,
        midDistance: 32,
        farDistance: AOI_CLIENT_CONFIG.maxRenderDistance,
      },
    };
  }

  if (midMemory && portrait) {
    return {
      name: "tablet-mid-portrait",
      deviceMemory,
      orientation,
      lookSens: 0.00305,
      lookLerp: 16,
      cameraDistance: 5.25,
      joystickRadius: 66,
      joystickDeadzone: 7,
      maxDevicePixelRatio: 1.65,
      renderBudget: {
        nearDistance: 18,
        midDistance: 38,
        farDistance: AOI_CLIENT_CONFIG.maxRenderDistance,
      },
    };
  }

  if (midMemory) {
    return {
      name: "tablet-mid-landscape",
      deviceMemory,
      orientation,
      lookSens: 0.00315,
      lookLerp: 17,
      cameraDistance: 5.4,
      joystickRadius: 68,
      joystickDeadzone: 6,
      maxDevicePixelRatio: 1.8,
      renderBudget: {
        nearDistance: 20,
        midDistance: 44,
        farDistance: AOI_CLIENT_CONFIG.maxRenderDistance,
      },
    };
  }

  if (portrait) {
    return {
      name: "desktop-portrait",
      deviceMemory,
      orientation,
      lookSens: 0.0032,
      lookLerp: 18,
      cameraDistance: 5.45,
      joystickRadius: 70,
      joystickDeadzone: 6,
      maxDevicePixelRatio: 2,
      renderBudget: {
        nearDistance: 22,
        midDistance: 52,
        farDistance: AOI_CLIENT_CONFIG.maxRenderDistance,
      },
    };
  }

  return {
    name: "desktop-landscape",
    deviceMemory,
    orientation,
    lookSens: 0.0032,
    lookLerp: 18,
    cameraDistance: 5.5,
    joystickRadius: 70,
    joystickDeadzone: 6,
    maxDevicePixelRatio: 2,
    renderBudget: {
      nearDistance: 22,
      midDistance: 60,
      farDistance: AOI_CLIENT_CONFIG.maxRenderDistance,
    },
  };
}

let cachedPreset: ClientPreset | null = null;

export function getClientPreset() {
  if (!cachedPreset) {
    cachedPreset = resolveClientPreset();
  }

  return cachedPreset;
}
