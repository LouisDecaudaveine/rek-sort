 import { z } from "zod";

 export type ContractMap = Record<string, {input: z.ZodType; output: z.ZodType}>;