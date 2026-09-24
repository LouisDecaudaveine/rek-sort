import express from "express";
import { AppError } from "./errors";
import { errorHandler } from "./middleware/error-handler";
import { rpcRouter } from "./routes/rpc";


export function createApp(){
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({limit: "100kb"}))
  

  app.get("/health", (_req, res) => {
    res.json({ok: true});
  })

  app.use("/api/rpc", rpcRouter);

  app.use((_req, _res, next) => next(new AppError(404, "NOT_FOUND", "Route not found")));
  app.use(errorHandler);
  
  return app;
}