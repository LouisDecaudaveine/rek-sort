import type { ErrorRequestHandler } from "express";
import { AppError } from "../errors";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError){
    res.status(err.status).json({
      ok: false,
      error: { code: err.code, message: err.message, details: err.details}
    })
    return;
  }

  if(typeof err?.status === "number" && err.status >= 400 && err.status < 500){
    res.status(err.status).json({
      ok: false,
      error: { code: "BAD_REQUEST", message: err.message}
    })
    return;
  }

  console.error(err);
  res.status(500).json({
    ok: false,
    error: { code: "INTERNAL", message: "Internal error" }
  })

}