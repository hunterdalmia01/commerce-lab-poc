import { FastifyInstance } from "fastify";
import db from "../db.js";
import { redis } from "../redis.js";

export async function productRoutes(app: FastifyInstance) {
  app.get("/products", async () => {
    const result = await db.query(`
      SELECT *
      FROM products
      ORDER BY id;
    `);

    return result.rows;
  });

  app.get("/products/:id", async (request, reply) => {
    const { id } = request.params as {
      id: string;
    };

    const cacheKey = `product:${id}`;
    const cachedProduct = await redis.get(cacheKey);

    if (cachedProduct) {
      app.log.info(`******************************************`);
      app.log.info(`Cache hit for product ${id}. Returning from cache.`);
      app.log.info(`******************************************`);
      return JSON.parse(cachedProduct);
    }
    app.log.info(`-----------------------------------------------------`);
    app.log.info(`Cache miss for product ${id}. Fetching from database.`);
    app.log.info(`-----------------------------------------------------`);

    const result = await db.query(
      `
      SELECT *
      FROM products
      WHERE id = $1;
      `,
      [id],
    );

    if (!result.rows.length) {
      return reply.code(404).send({
        message: "Product not found",
      });
    }

    const product = result.rows[0];
    await redis.set(cacheKey, JSON.stringify(product), "EX", 300); // Cache for 5 minutes

    return product;
  });
}
