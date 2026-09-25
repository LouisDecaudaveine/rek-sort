import { z } from "zod";
import { ContractMap } from "./types";

export const systemContracts = {
  "system.ping": {
    input: z.object({}),
    output: z.object({pong: z.literal(true)})
  }
} satisfies ContractMap;