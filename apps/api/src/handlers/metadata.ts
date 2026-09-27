import { randomUUID } from "node:crypto";
import type { HandlerMap } from "./types";

export const metadataHandler: HandlerMap<"metadata"> = {
  "metadata.tracks.create": async (input) => {
    return { id: Math.floor(Math.random()*100000000), name: input.name}
  }
}