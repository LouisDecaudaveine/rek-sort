import type { HandlerMap } from "./types";

export const systemHandler: HandlerMap<"system"> = {
  "system.ping": async (input) => {
    return { pong: true };
  },
}