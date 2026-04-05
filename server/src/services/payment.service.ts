import dayjs from "dayjs";
import { adminDb } from "./firebase-admin";

export type PaymentStatus = "PENDING" | "PAID" | "FAILED";
export type OrderPaymentStatus = "PENDING" | "PAID" | "FAILED";

export async function createPendingPayment(payload: {
  paymentId: string;
  orderId: string;
  userId: string;
  customerName: string;
  customerPhone: string;
  amount: number;
  totalProductAmount: number;
  shipFee: number;
}) {
  const now = dayjs().toISOString();

  await adminDb.collection("Payments").doc(payload.paymentId).set({
    id: payload.paymentId,
    orderId: payload.orderId,
    idUser: payload.userId,
    customerName: payload.customerName,
    customerPhone: payload.customerPhone,
    amount: payload.amount,
    totalProductAmount: payload.totalProductAmount,
    shipFee: payload.shipFee,
    status: "PENDING",
    typePayment: "BANK_TRANSFER",
    source: "ORDER",
    createdAt: now,
    paidAt: null,
    failedAt: null,
    paymentGateway: "VNPAY",
    gatewayTxnRef: payload.paymentId,
    gatewayTransactionNo: null,
    gatewayResponseCode: null,
    gatewayTransactionStatus: null,
    updatedAt: now,
    dateKey: dayjs(now).format("YYYY-MM-DD"),
    monthKey: dayjs(now).format("YYYY-MM"),
    hourOfDay: Number(dayjs(now).format("H")),
    timeBucket: dayjs(now).format("HH:00"),
  });
}

export async function markPaymentPaid(params: {
  paymentId: string;
  vnpTransactionNo?: string;
  vnpResponseCode?: string;
  vnpTransactionStatus?: string;
  payDate?: string;
  bankCode?: string;
}) {
  const now = dayjs().toISOString();

  await adminDb.collection("Payments").doc(params.paymentId).set(
    {
      status: "PAID",
      paidAt: params.payDate || now,
      failedAt: null,
      gatewayTransactionNo: params.vnpTransactionNo || null,
      gatewayResponseCode: params.vnpResponseCode || null,
      gatewayTransactionStatus: params.vnpTransactionStatus || null,
      bankCode: params.bankCode || null,
      updatedAt: now,
    },
    { merge: true },
  );

  await syncOrderPaymentStatus(params.paymentId, "PAID");
}

export async function markPaymentFailed(params: {
  paymentId: string;
  vnpTransactionNo?: string;
  vnpResponseCode?: string;
  vnpTransactionStatus?: string;
  bankCode?: string;
}) {
  const now = dayjs().toISOString();

  await adminDb.collection("Payments").doc(params.paymentId).set(
    {
      status: "FAILED",
      failedAt: now,
      gatewayTransactionNo: params.vnpTransactionNo || null,
      gatewayResponseCode: params.vnpResponseCode || null,
      gatewayTransactionStatus: params.vnpTransactionStatus || null,
      bankCode: params.bankCode || null,
      updatedAt: now,
    },
    { merge: true },
  );

  await syncOrderPaymentStatus(params.paymentId, "FAILED");
}

async function syncOrderPaymentStatus(paymentId: string, status: OrderPaymentStatus) {
  const paymentSnap = await adminDb.collection("Payments").doc(paymentId).get();
  if (!paymentSnap.exists) return;

  const payment = paymentSnap.data();
  const orderId = payment?.orderId;
  if (!orderId) return;

  await adminDb.collection("Orders").doc(orderId).set(
    {
      statusPayment: status,
      updatedAt: dayjs().toISOString(),
    },
    { merge: true },
  );
}