import { contracts, type FunctionName } from "./contracts"
import { handlers } from "./handlers";
import { AppError } from './errors'


function isFunctionName(name: string): name is FunctionName {
  return Object.hasOwn(contracts, name);
}

export async function dispatch(name: string, payload: unknown): Promise<unknown> {
  if(!isFunctionName(name)){
    throw new AppError(404, "UKNOWN_FUNCTION", `Unknown function: ${name}`);
  }

  const contract = contracts[name];

  const input = contract.input.safeParse(payload);
  if(!input.success){
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Invalid payload",
      input.error.issues.map(i => ({
        path: i.path.map(String).join("."),
        message: i.message,
      }))
    )
  }

  const handler = handlers[name] as (input: unknown) => Promise<unknown>;
  const result = await handler(input.data)

  const output = contract.output.safeParse(result)
  if(!output.success){
    console.error(`Handler ${name} returned invalid output`);
    throw new AppError(500, "INVALID OUTPUT", "Internal error")
  }

  return output.data;
}
