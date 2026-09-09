import { FastifyInstance } from "fastify";
import { z } from "zod";
import db from "../db.js";
import { createOrderSchema } from "../schemas/orderSchema.js";
import { kafkaProducer } from "../kafka.js";


export async function orderRoutes(app: FastifyInstance) {
  app.post("/orders", async (request, reply) => {
    const body = createOrderSchema.parse(request.body);

    const productResult = await db.query(
      `
      SELECT *
      FROM products
      WHERE id = $1;
      `,
      [body.productId],
    );

    if (!productResult.rows.length) {
      return reply.code(404).send({
        message: "Product not found",
      });
    }

    const product = productResult.rows[0];

    const total = product.price * body.quantity;

    const orderResult = await db.query(
      `
      INSERT INTO orders (
        product_id,
        quantity,
        total,
        status
      )
      VALUES ($1, $2, $3, 'PENDING')
      RETURNING *;
      `,
      [body.productId, body.quantity, total],
    );

    const order = orderResult.rows[0];

    await kafkaProducer.send({
      topic: "order.created",
      messages: [
        {
          key: String(order.id),
          value: JSON.stringify({
            orderId: order.id,
            productId: body.productId,
            quantity: body.quantity,
            total,
          }),
        },
      ],
    });

    return reply.code(201).send(order);
  });

  app.get("/orders/:id", async (request, reply) => {
    const { id } = request.params as {
      id: string;
    };

    const result = await db.query(
      `
      SELECT *
      FROM orders
      WHERE id = $1;
      `,
      [id],
    );

    if (!result.rows.length) {
      return reply.code(404).send({
        message: "Order not found",
      });
    }

    return result.rows[0];
  });
}