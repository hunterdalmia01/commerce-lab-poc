"use client";

import { useEffect, useState } from "react";

type Product = {
  id: number;
  name: string;
  description: string;
  price: number;
};

type CartItem = Product & {
  quantity: number;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [orderId, setOrderId] = useState<number | null>(null);
  const [orderStatus, setOrderStatus] = useState<string | null>(null);

  useEffect(() => {
    async function loadProducts() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/products`);
        const data = await response.json();
        setProducts(data);
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, []);

  function addToCart(product: Product) {
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);

      if (existing) {
        return current.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }

      return [...current, { ...product, quantity: 1 }];
    });
  }

  async function placeOrder() {
    if (cart.length === 0) {
      return;
    }

    const item = cart[0];

    const response = await fetch(`${API_BASE_URL}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        productId: item.id,
        quantity: item.quantity,
      }),
    });

    const order = await response.json();

    setOrderId(order.id);
    setOrderStatus(order.status);
  }

  useEffect(() => {
  if (!orderId) {
    return;
  }

  const interval = setInterval(async () => {
    const response = await fetch(`${API_BASE_URL}/api/orders/${orderId}`);

    const order = await response.json();

    setOrderStatus(order.status);

    if (order.status === "CONFIRMED") {
      clearInterval(interval);
    }
  }, 1000);

  return () => clearInterval(interval);
}, [orderId]);

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  if (loading) {
    return <main className="p-8">Loading...</main>;
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-4xl font-bold">Commerce Lab</h1>

        <div className="mt-8 grid gap-8 lg:grid-cols-[2fr_1fr]">
          <section>
            <div className="grid gap-6 md:grid-cols-2">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="rounded-xl bg-white p-6 shadow"
                >
                  <h2 className="text-xl font-semibold">{product.name}</h2>

                  <p className="mt-2 text-gray-600">{product.description}</p>

                  <p className="mt-4 text-lg font-bold">
                    ₹{product.price.toLocaleString("en-IN")}
                  </p>

                  <button
                    onClick={() => addToCart(product)}
                    className="mt-4 rounded bg-black px-4 py-2 text-white"
                  >
                    Add to cart
                  </button>
                </div>
              ))}
            </div>
          </section>

          <aside className="rounded-xl bg-white p-6 shadow">
            <h2 className="text-2xl font-semibold">Cart</h2>

            {cart.length === 0 ? (
              <p className="mt-4 text-gray-500">Your cart is empty.</p>
            ) : (
              <>
                <div className="mt-4 space-y-3">
                  {cart.map((item) => (
                    <div key={item.id} className="flex justify-between">
                      <span>
                        {item.name} × {item.quantity}
                      </span>

                      <span>
                        ₹{(item.price * item.quantity).toLocaleString("en-IN")}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-6 border-t pt-4">
                  <div className="flex justify-between font-bold">
                    <span>Total</span>
                    <span>₹{total.toLocaleString("en-IN")}</span>
                  </div>
                  <button
                    onClick={placeOrder}
                    className="mt-6 w-full rounded bg-green-600 px-4 py-3 text-white"
                  >
                    Place order
                  </button>

                  {orderId && (
                    <div className="mt-6 rounded bg-gray-100 p-4">
                      <p>Order #{orderId}</p>
                      <p>Status: {orderStatus}</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
