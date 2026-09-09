import db from "./db.js";

export async function initDb() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      price INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      product_id INTEGER REFERENCES products(id),
      quantity INTEGER NOT NULL,
      total INTEGER NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  const result = await db.query(`
    SELECT COUNT(*) FROM products;
  `);

  if (Number(result.rows[0].count) === 0) {
    await db.query(`
      INSERT INTO products (name, description, price)
      VALUES
        ('Running Shoe', 'Lightweight everyday running shoe', 8999),
        ('Training T-Shirt', 'Breathable gym t-shirt', 1999),
        ('Gym Bag', 'Compact training bag', 2499);
    `);
  }
}