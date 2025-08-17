import { Hono } from "hono";
const app = new Hono();

// Operation
// CRUD

app.get("/", (c) => c.text("Hello, World!"));

export default app;