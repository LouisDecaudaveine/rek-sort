import { AppError } from './errors'

type Handler = (payload: unknown) => Promise<unknown>;

const handlers = new Map<string, Handler>(
  [["system.ping", async () => ({pong: true})]]
);


export async function dispatch(name: string, payload: unknown){
  const handler = handlers.get(name);
  if (!handler) throw new AppError(404, "UNKNOWN FUNCTION", `Unknown function: ${name}`);

  return handler(payload);
}