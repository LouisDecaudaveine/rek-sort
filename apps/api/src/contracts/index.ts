import { z } from "zod"; 
import { metadataContracts } from "./metadata";
import { systemContracts } from "./system";


export const contracts = {
  ...systemContracts,
  ...metadataContracts,
}

export type FunctionName = keyof typeof contracts;
export type Input<N extends FunctionName> = z.infer<(typeof contracts)[N]["input"]>;
export type Output<N extends FunctionName> = z.infer<(typeof contracts)[N]["output"]>;

export type ServiceOf<N extends string> = N extends `${infer S}.${string}` ? S : never;