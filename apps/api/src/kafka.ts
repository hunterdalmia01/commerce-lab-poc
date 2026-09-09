import { Kafka } from "kafkajs";

const brokers =
  process.env.KAFKA_BROKERS?.split(",") ??
  ["localhost:9093"];

const username = process.env.KAFKA_USERNAME;
const password = process.env.KAFKA_PASSWORD;
const caCert = process.env.KAFKA_CA_CERT;

const isAiven =
  Boolean(username) &&
  Boolean(password) &&
  Boolean(caCert);

const caPath =
  process.env.KAFKA_CA_PATH ??
  "./certs/ca.pem";


const kafkaClient = new Kafka({
  clientId: "commerce-lab-api",
  brokers,
  ssl: isAiven
    ? {
        rejectUnauthorized: true,
        ca: [caCert!],
      }
    : false,

  ...(isAiven && {
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