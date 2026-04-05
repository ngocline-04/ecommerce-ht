import "dotenv/config";
import express from "express";
import cors from "cors";
import vnpayRoutes from "./routes/vnpay.routes";

const app = express();

app.use(
  cors({
    origin: [
      process.env.APP_BASE_URL || "http://localhost:3000",
      "http://localhost:3000",
      "http://localhost:5173",
    ],
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (_req, res) => {
  return res.json({
    ok: true,
    service: "payment-server",
    time: new Date().toISOString(),
  });
});

app.use("/api/vnpay", vnpayRoutes);

const port = Number(process.env.PORT || 5001);

app.listen(port, () => {
  console.log(`Payment server running on port ${port}`);
});