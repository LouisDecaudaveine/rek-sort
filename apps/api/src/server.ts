import { createApp } from "./app";
import { config } from "./config";

const server = createApp().listen(config.PORT, () => {
  console.log(`api listening on: ${config.PORT}`);
})

process.on("SIGTERM", () => server.close(() => process.exit(0)));