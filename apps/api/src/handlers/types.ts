import type { FunctionName, Input, Output } from "../contracts";

export type Handler<N extends FunctionName> = (input: Input<N>) => Promise<Output<N>>;

export type HandlerMap<S extends string> = {
  [N in Extract<FunctionName, `${S}.${string}`>]: Handler<N>;
};