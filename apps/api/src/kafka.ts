import { Kafka } from "kafkajs";
import fs from "node:fs";
import path from "node:path";

const brokers =
  process.env.KAFKA_BROKERS?.split(",") ??
  ["localhost:9093"];

const username = process.env.KAFKA_USERNAME;
const password = process.env.KAFKA_PASSWORD;

const useCloudKafka = Boolean(username && password);

const caPath =
  process.env.KAFKA_CA_PATH ??
  "./certs/ca.pem";


const kafkaClient = new Kafka({
  clientId: "commerce-lab-api",
  brokers,
  ssl: useCloudKafka
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

  ...(useCloudKafka && {
    sasl: {
      mechanism: "plain" as const,
      username: username!,
      password: password!,
    },
  }),
});



export const kafkaProducer = kafkaClient.producer();

export async function connectKafkaProducer() {
  await kafkaProducer.connect();
  console.log("Kafka producer connected");
}