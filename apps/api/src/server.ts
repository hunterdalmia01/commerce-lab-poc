import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";

import { initDb } from "./init-db.js";
import { productRoutes } from "./routes/products.js";
import { connectKafkaProducer } from "./kafka.js";
import { orderRoutes } from "./routes/orders.js";

await initDb();
await connectKafkaProducer();

const app = Fastify({
  logger: true,
});

await app.register(cors, {
  origin: true,
});

await app.register(productRoutes, {
    prefix: "/api",
});

await app.register(orderRoutes, {
    prefix: "/api",
});

app.get("/health", async () => {
  return { status: "ok", service: "commerce-lab-api" };
});

const port = Number(process.env.PORT ?? 4000);

const start = async () => {
  await app.listen({
    host: "0.0.0.0",
    port,
  });
};

start().catch((error) => {
  app.log.error(error);
  process.exit(1);
});
