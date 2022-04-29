import { InitialShipInput } from "../archetypes/ship";

export const shipClasses: Record<
  "shipA" | "shipB" | "minerA" | "minerB",
  Omit<InitialShipInput, "position" | "sim" | "owner">
> = {
  shipA: {
    name: "Ship Type A",
    drive: {
      cruise: 4,
      maneuver: 0.3,
      rotary: 1.46,
      ttc: 3,
    },
    storage: 10,
    mining: 0,
  },
  shipB: {
    name: "Ship Type B",
    drive: {
      cruise: 4.6,
      maneuver: 0.55,
      rotary: 1.98,
      ttc: 2,
    },
    storage: 6,
    mining: 0,
  },

  minerA: {
    name: "Mining Ship Type A",
    drive: {
      cruise: 3,
      maneuver: 0.2,
      rotary: 1.169,
      ttc: 6,
    },
    storage: 40,
    mining: 1,
  },
  minerB: {
    name: "Mining Ship Type B",
    drive: {
      cruise: 4,
      maneuver: 0.5,
      rotary: 1.361,
      ttc: 3.5,
    },
    storage: 24,
    mining: 1.3,
  },
};
