import { z } from "zod";
import { ContractMap } from "./types";

export const metadataContracts = {
  "metadata.tracks.create": {
    input: z.object({
      name: z.string().trim().min(1).max(200),
      artist: z.string().trim().max(200).optional(),
      album: z.string().trim().max(200).optional(),
    }),
    output: z.object({
      id: z.uuid(),
      name: z.string(),
    }),
  }
} satisfies ContractMap;