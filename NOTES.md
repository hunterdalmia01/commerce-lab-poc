# Commerce Lab POC Notes

This document explains the project in two ways:

1. A plain-language overview for someone seeing the project for the first time.
2. A technical reference for developers who need to run, change, or extend it.

The project is a learning-oriented commerce proof of concept. It is intentionally small, but it demonstrates several pieces commonly found in a real online store: a browser interface, an API, a relational database, a cache, an event broker, a background worker, and the beginning of an authentication data model.

## What Has Been Built

### In plain language

A customer can open the web page and see products. They can add products to a cart and place an order. The order is first recorded as `PENDING`. The API sends an event to a message system, and a separate worker receives that event. After a short simulated processing delay, the worker changes the order to `CONFIRMED`. The web page checks the order periodically and displays the updated status.

The application has four main parts:

- **Web app:** The page a customer sees in the browser.
- **API:** The backend that accepts requests and applies business rules.
- **Database:** PostgreSQL stores products and orders permanently.
- **Worker:** A background process that handles order-confirmation events.

Redis makes product-detail reads faster by temporarily remembering recently requested products. Redpanda provides a Kafka-compatible event stream so order processing can happen separately from the original HTTP request.

### What a normal order looks like

1. The browser requests the product list from the API.
2. The customer adds a product to the cart.
3. The browser sends `POST /api/orders` with a product ID and quantity.
4. The API checks that the product exists and creates a `PENDING` order.
5. The API publishes an `order.created` event to Redpanda.
6. The API immediately returns the new order to the browser.
7. The worker consumes the event, waits three seconds to simulate processing, and marks the order `CONFIRMED`.
8. The browser polls `GET /api/orders/:id` and displays the new status.

This is deliberately asynchronous: the customer does not have to wait for the worker to finish before the API responds.

## Current Status

| Area | Status | Details |
| --- | --- | --- |
| Product catalog | Working | Products are listed from PostgreSQL; product details use Redis caching. |
| Cart | Working | The browser can hold multiple products locally. |
| Checkout | Working, limited | The current API accepts one product and quantity per order; the page submits the first cart item. |
| Order creation | Working | Orders are validated, stored as `PENDING`, and published to Redpanda. |
| Order confirmation | Working | The worker changes matching orders to `CONFIRMED` after three seconds. |
| Authentication | Data model only | User, role, and account-status tables exist in Prisma, but login and registration routes are not implemented. |
| Prisma | Partially adopted | Schema, migrations, seed script, and client helper exist; current product/order runtime code still uses `pg`. |
| Nginx | Available for local proxying | Compose includes a proxy on port `8081`; it forwards browser traffic to the host web app and API container. |
| Automated tests | Not yet added | Manual API and browser checks are currently the main verification path. |

## Architecture

```mermaid
flowchart LR
    Browser[Customer browser] -->|localhost:3000| Web[Next.js web app]
    Web -->|HTTP JSON| API[Fastify API]
    API -->|products and orders| DB[(PostgreSQL)]
    API -->|product cache| Redis[(Redis)]
    API -->|order.created| Events[(Redpanda / Kafka)]
    Events --> Worker[Order worker]
    Worker -->|set CONFIRMED| DB
    Nginx[Nginx :8081] -. optional local proxy .-> Web
    Nginx -. optional /api proxy .-> API
```

The web app and API are separate development processes. The browser-facing API origin is controlled by `NEXT_PUBLIC_API_BASE_URL`. For local development, use `http://localhost:4000`; for a deployed frontend, use the deployed API URL. The Nginx configuration is optional and is not required when running the web app and API directly.

## Repository Layout

```text
commerce-lab-poc/
├── apps/
│   ├── web/
│   │   ├── src/app/page.tsx       # Product list, cart, checkout, status polling
│   │   ├── src/app/layout.tsx     # Root layout and metadata
│   │   ├── src/app/globals.css    # Global styles and Tailwind import
│   │   └── .env.local             # Browser-facing API URL
│   ├── api/
│   │   ├── src/server.ts          # Fastify startup and route registration
│   │   ├── src/routes/            # Product and order endpoints
│   │   ├── src/init-db.ts         # Runtime table creation and product seed
│   │   ├── src/db.ts              # PostgreSQL pool used by current routes
│   │   ├── src/lib/prisma.ts      # Prisma client singleton
│   │   ├── src/redis.ts           # Redis client
│   │   ├── src/kafka.ts           # Kafka producer
│   │   ├── prisma/schema.prisma   # Prisma models
│   │   ├── prisma/migrations/     # Versioned database migrations
│   │   ├── prisma/seed.ts         # Initial roles seed
│   │   └── prisma.config.ts       # Prisma schema, migration, and seed config
│   └── worker/
│       └── src/worker.ts          # Kafka consumer and order confirmation
├── nginx/nginx.conf               # Optional reverse-proxy configuration
├── docker-compose.yml             # PostgreSQL, Redis, Redpanda, API, worker, Nginx
├── package.json                   # Root npm workspace commands
├── README.md                      # Quick-start guide
└── NOTES.md                       # Detailed project explanation
```

## Local Services

Docker Compose defines these services:

| Service | Host address | Purpose |
| --- | --- | --- |
| PostgreSQL | `localhost:5432` | Products, orders, users, and roles |
| Redis | `localhost:6379` | Product-detail cache |
| Redpanda | `localhost:9092` | Kafka-compatible order events |
| API container | `localhost:4000` | Optional containerized API |
| Nginx | `localhost:8081` | Optional local reverse proxy |
| Worker container | no host port | Optional containerized worker |

There are two ways to run the application:

- **Recommended for learning and development:** Run only PostgreSQL, Redis, and Redpanda in Docker. Run the web app, API, and worker from the repository with npm so file watching and logs are easy to see.
- **Container mode:** Run the full Compose stack. This is useful for checking container startup, but it is less convenient for editing source code and requires the container images to be rebuilt after code changes.

Do not run the host API and the Compose API at the same time: both try to use port `4000`. The same applies to a host worker and a Compose worker consuming the same event stream.

## Database and Prisma

PostgreSQL is the source of truth for application data. The project currently has a transition between two database approaches:

- Existing product and order routes use the `pg` connection pool in `src/db.ts`.
- Prisma defines the database models, stores versioned migrations, generates a typed client, and seeds roles.

The Prisma schema currently contains:

- `products`: catalog items with name, description, price, and creation time.
- `orders`: product reference, quantity, total, status, and creation time.
- `User`: account identity, password hash, verification state, login lockout state, and timestamps.
- `Role`: role codes such as `CUSTOMER`, `SELLER`, and `ADMIN`.
- `UserRole`: many-to-many relationship between users and roles.
- `UserStatus`: `ACTIVE`, `LOCKED`, `SUSPENDED`, and `DELETED`.

For a fresh local database, run migrations and seed the initial roles from `apps/api`:

```bash
cd apps/api
npx prisma migrate deploy
npx prisma db seed
cd ../..
```

The API startup still creates the `products` and `orders` tables and inserts three sample products when the product table is empty. Prisma migrations should still be run because they create the newer user and role tables. The Prisma client can be regenerated with:

```bash
npm exec prisma generate --workspace=apps/api
```

Do not commit real database credentials. Use `.env.example` as a template and keep local secrets in ignored `.env` files.

## API Reference

The API listens on port `4000` by default. All business routes use the `/api` prefix.

| Method | Route | Behavior |
| --- | --- | --- |
| `GET` | `/health` | Returns `{ status: "ok", service: "commerce-lab-api" }`. |
| `GET` | `/api/products` | Returns products ordered by ID. |
| `GET` | `/api/products/:id` | Returns one product and caches it in Redis for five minutes. |
| `POST` | `/api/orders` | Validates, creates, and publishes an order. |
| `GET` | `/api/orders/:id` | Returns one order and its current status. |

Create an order manually:

```bash
curl -X POST http://localhost:4000/api/orders \
  -H 'content-type: application/json' \
  -d '{"productId":1,"quantity":2}'
```

The request requires positive integer values. A successful response is initially `PENDING`. After the worker processes the event, query the returned ID:

```bash
curl http://localhost:4000/api/orders/1
```

The API currently calculates totals from the product price. Prices are stored as integers representing the smallest currency unit used by the UI, and the web page formats them as Indian rupees.

## Environment Variables

### API: `apps/api/.env`

| Variable | Purpose | Local example |
| --- | --- | --- |
| `PORT` | API listening port | `4000` |
| `DATABASE_URL` | PostgreSQL or hosted PostgreSQL connection string | `postgresql://commerce:commerce@localhost:5432/commerce` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `KAFKA_BROKERS` | Comma-separated broker list | `localhost:9092` |
| `KAFKA_USERNAME` | Optional hosted Kafka username | Leave blank locally |
| `KAFKA_PASSWORD` | Optional hosted Kafka password | Leave blank locally |
| `KAFKA_CA_CERT` | Optional hosted Kafka certificate path | Leave blank locally unless TLS is used |

### Worker: `apps/worker/.env`

The worker needs `DATABASE_URL` and `KAFKA_BROKERS`. Its Kafka username, password, and CA certificate are optional for local Redpanda and required only for a secured hosted Kafka setup.

### Web: `apps/web/.env.local`

Set the browser-facing API URL for local development:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

This value is compiled into the browser bundle. Restart the Next.js development server after changing it. If the web app is opened through Nginx on port `8081`, the API URL can instead be empty because Nginx proxies `/api` requests.

## Development Workflow

Recommended startup order:

1. Install dependencies from the repository root.
2. Start PostgreSQL, Redis, and Redpanda.
3. Apply Prisma migrations and seed roles.
4. Confirm the API and worker environment files point to the same services.
5. Start the API.
6. Start the worker.
7. Start the web app.
8. Open the web page and place a test order.

The API must start before the browser can load products. The worker must start before an order can move from `PENDING` to `CONFIRMED`.

## Known Limitations

- The cart can contain multiple products, but checkout submits only the first cart item.
- There are no automated unit, integration, or end-to-end tests yet.
- Authentication tables exist, but there are no registration, login, session, password-reset, or authorization routes.
- Current routes use `pg`; Prisma runtime queries are not yet the source of the product/order implementation.
- The API and worker do not yet have complete graceful-shutdown handling.
- Error handling for unavailable PostgreSQL, Redis, and Redpanda is still basic.
- Nginx is a local development proxy, not a production deployment configuration.
- The Dockerfiles build the API and worker separately and do not run migrations automatically. Apply database migrations explicitly before relying on newly added Prisma tables.

## Next Sensible Steps

1. Add tests for health, product caching, order validation, event publication, and worker confirmation.
2. Finish moving product and order queries from `pg` to Prisma, or document a deliberate decision to keep both layers.
3. Implement authentication and authorization around the existing user and role models.
4. Change the order contract to support multiple cart items.
5. Add reliable error handling, retries, and graceful shutdown for all long-running processes.
6. Add CI checks for typechecking, linting, builds, migrations, and tests.
7. Define a production deployment topology before expanding Nginx or container configuration.

## Working Agreements

- Keep application code inside the relevant workspace under `apps/`.
- Keep quick-start commands and prerequisites in `README.md`.
- Keep implementation context, limitations, and architecture decisions here.
- Never document a service as complete unless its command and health check have been verified.
- Never commit passwords, hosted database URLs, Kafka credentials, certificates, or other secrets.
