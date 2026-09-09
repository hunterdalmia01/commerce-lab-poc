import "dotenv/config";

import fs from "node:fs";
import path from "node:path";
import { Kafka } from "kafkajs";
import pg from "pg";

const { Pool } = pg;

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const brokers =
  process.env.KAFKA_BROKERS?.split(",") ??
  ["localhost:9093"];

const caPath =
  process.env.KAFKA_CA_PATH ??
  "./certs/ca.pem";


const username = process.env.KAFKA_USERNAME;
const password = process.env.KAFKA_PASSWORD;

const kafka = new Kafka({
  clientId: "commerce-worker",
  brokers,
  ssl: username && password
    ? {
        rejectUnauthorized: true,
        ca: [
          fs.readFileSync(
            path.resolve(process.cwd(), caPath),
            "utf8",
          ),
        ],
      }
    : false,

  ...(username &&
    password && {
      sasl: {
        mechanism: "plain" as const,
        username,
        password,
      },
    }),
});


const consumer = kafka.consumer({
  groupId: "order-processing",
});

async function start() {
  await consumer.connect();

  await consumer.subscribe({
    topic: "order.created",
    fromBeginning: false,
  });

  console.log("Order worker started");

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) {
        return;
      }

      const event = JSON.parse(
        message.value.toString(),
      );

      console.log(
        `Processing order ${event.orderId}`,
      );

      await new Promise((resolve) =>
        setTimeout(resolve, 3000),
      );

      await db.query(
        `
        UPDATE orders
        SET status = 'CONFIRMED'
        WHERE id = $1;
        `,
        [event.orderId],
      );

      console.log(
        `Order ${event.orderId} confirmed`,
      );
    },
  });
}

start().catch(console.error);