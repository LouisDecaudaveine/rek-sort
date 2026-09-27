import type { FunctionName } from "../contracts";
import type { Handler } from "./types";
import { systemHandler } from "./system";
import { metadataHandler } from "./metadata";

export const handlers: { [N in FunctionName] : Handler<N> } = {
  ...systemHandler,
  ...metadataHandler,
}