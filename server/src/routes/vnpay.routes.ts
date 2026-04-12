import express from "express";
import dayjs from "dayjs";
import { adminDb } from "../services/firebase_admin";
import { sendOrderConfirmationEmail } from "../services/mail.service";
import {
  createVnpayPaymentUrl,
  verifyVnpayReturnUrl,
  verifyVnpayIpnCall,
} from "../services/vnpay.service";

const router = express.Router();

const PAYMENT_EXPIRE_MINUTES = 30;

function getExpireInfo(createdAt?: string | null) {
  const createdMs = createdAt ? dayjs(createdAt).valueOf() : 0;
  const expireMs = createdMs + PAYMENT_EXPIRE_MINUTES * 60 * 1000;
  const nowMs = dayjs().valueOf();
  const remainingMs = Math.max(0, expireMs - nowMs);

  return {
    createdMs,
    expireMs,
    nowMs,
    expired: nowMs >= expireMs,
    remainingMs,
    remainingSeconds: Math.floor(remainingMs / 1000),
  };
}
function getClientIp(req: express.Request) {
  const forwarded = req.headers["x-forwarded-for"];
  let ip =
    typeof forwarded === "string"
      ? forwarded.split(",")[0].trim()
      : req.socket.remoteAddress || "127.0.0.1";

  if (ip === "::1") return "127.0.0.1";
  if (ip.startsWith("::ffff:")) return ip.replace("::ffff:", "");
  return ip;
}

router.post("/create-from-order", async (req, res) => {
  try {
    const {
      orderId,
      paymentId,
      userId,
      customerName,
      customerPhone,
      totalProductAmount,
      shipFee,
      amount,
      bankCode,
    } = req.body || {};

    if (!orderId || !paymentId || !amount) {
      return res.status(400).json({ message: "Thiếu dữ liệu thanh toán" });
    }

    const paymentRef = adminDb.collection("Payments").doc(String(paymentId));
    const paymentSnap = await paymentRef.get();

    if (!paymentSnap.exists) {
      return res.status(404).json({ message: "Không tìm thấy payment" });
    }

    await paymentRef.set(
      {
        orderId: String(orderId),
        idUser: String(userId || ""),
        customerName: String(customerName || ""),
        customerPhone: String(customerPhone || ""),
        amount: Number(amount || 0),
        totalProductAmount: Number(totalProductAmount || 0),
        shipFee: Number(shipFee || 0),
        status: "UNPAID",
        typePayment: "BANK_TRANSFER",
        paymentGateway: "VNPAY",
        gatewayTxnRef: String(paymentId),
        updatedAt: dayjs().toISOString(),
      },
      { merge: true },
    );

    const paymentUrl = createVnpayPaymentUrl({
      amount: Number(amount || 0),
      txnRef: String(paymentId),
      orderInfo: `Thanh toan don hang ${orderId}`,
      ipAddr: getClientIp(req),
      bankCode,
    });

    return res.json({
      orderId,
      paymentId,
      paymentUrl,
    });
  } catch (error) {
    console.error("VNPAY create-from-order error:", error);
    return res.status(500).json({
      message:
        error instanceof Error
          ? error.message
          : "Không tạo được URL thanh toán",
    });
  }
});

router.post("/send-cod-mail", async (req, res) => {
  try {
    const { orderId, userId, customerName, customerEmail, totalAmount } =
      req.body || {};

    if (!orderId) {
      return res.status(400).json({ message: "Thiếu orderId" });
    }

    let email = String(customerEmail || "").trim();

    if (!email && userId) {
      const userSnap = await adminDb
        .collection("Users")
        .doc(String(userId))
        .get();
      const userData = userSnap.data() || {};
      email = String(userData.email || "").trim();
    }

    if (!email) {
      return res
        .status(400)
        .json({ message: "Không tìm thấy email khách hàng" });
    }

    await sendOrderConfirmationEmail({
      to: email,
      customerName: String(customerName || ""),
      orderId: String(orderId),
      totalAmount: Number(totalAmount || 0),
      paymentType: "Thanh toán khi nhận hàng",
      paymentStatusText: "Thanh toán khi nhận hàng",
    });

    return res.json({ ok: true });
  } catch (error) {
    console.error("send-cod-mail error:", error);
    return res.status(500).json({
      message: error instanceof Error ? error.message : "Không gửi được email",
    });
  }
});

router.get("/vnpay_return", async (req, res) => {
  try {
    const result = verifyVnpayReturnUrl(req.query);
    console.log("VNPAY RETURN:", result);

    const ok = result.isSuccess;

    const paymentId = String(req.query.vnp_TxnRef || "");
    const responseCode = String(req.query.vnp_ResponseCode || "");
    const transactionStatus = String(req.query.vnp_TransactionStatus || "");
    const transactionNo = String(req.query.vnp_TransactionNo || "");
    const bankCode = String(req.query.vnp_BankCode || "");
    const payDate = String(req.query.vnp_PayDate || "");

    if (paymentId) {
      const paymentRef = adminDb.collection("Payments").doc(paymentId);
      const paymentSnap = await paymentRef.get();

      if (paymentSnap.exists) {
        const paymentData = paymentSnap.data() || {};
        const orderId = String(paymentData.orderId || "");
        const userId = String(paymentData.idUser || "");
        const totalAmount = Number(paymentData.amount || 0);
        const customerName = String(paymentData.customerName || "");

        await paymentRef.set(
          {
            status: ok ? "PAID" : "UNPAID",
            paidAt: ok ? dayjs().toISOString() : null,
            failedAt: ok ? null : dayjs().toISOString(),
            gatewayResponseCode: responseCode || null,
            gatewayTransactionNo: transactionNo || null,
            gatewayTransactionStatus: transactionStatus || null,
            bankCode: bankCode || null,
            updatedAt: dayjs().toISOString(),
            gatewayPayDate: payDate || null,
          },
          { merge: true },
        );

        if (orderId) {
          await adminDb
            .collection("Orders")
            .doc(orderId)
            .set(
              {
                statusPayment: ok ? "PAID" : "UNPAID",
                updatedAt: dayjs().toISOString(),
              },
              { merge: true },
            );
        }

        if (ok && userId) {
          const userSnap = await adminDb.collection("Users").doc(userId).get();
          const userData = userSnap.data() || {};
          const email = String(userData.email || "").trim();

          if (email) {
            await sendOrderConfirmationEmail({
              to: email,
              customerName,
              orderId,
              totalAmount,
              paymentType: "VNPAY",
              paymentStatusText: "Đã thanh toán",
            });
          }
        }
      }
    }

    return res.redirect(
      `${process.env.APP_BASE_URL || "http://localhost:3000"}/checkout?status=${ok ? "success" : "failed"}&paymentId=${encodeURIComponent(paymentId)}&responseCode=${encodeURIComponent(responseCode)}&transactionStatus=${encodeURIComponent(transactionStatus)}`,
    );
  } catch (error) {
    console.error("VNPAY return error:", error);
    return res.redirect(
      `${process.env.APP_BASE_URL || "http://localhost:3000"}/checkout?status=error`,
    );
  }
});

router.get("/vnpay_ipn", async (req, res) => {
  try {
    const result = verifyVnpayIpnCall(req.query);

    if (!result.isVerified) {
      return res
        .status(200)
        .json({ RspCode: "97", Message: "Invalid signature" });
    }

    const paymentId = String(result.vnp_TxnRef || "");
    const responseCode = String(result.vnp_ResponseCode || "");
    const transactionStatus = String(result.vnp_TransactionStatus || "");
    const transactionNo = String(result.vnp_TransactionNo || "");
    const bankCode = String(result.vnp_BankCode || "");

    if (!paymentId) {
      return res
        .status(200)
        .json({ RspCode: "01", Message: "Order not found" });
    }

    const paymentRef = adminDb.collection("Payments").doc(paymentId);
    const paymentSnap = await paymentRef.get();

    if (!paymentSnap.exists) {
      return res
        .status(200)
        .json({ RspCode: "01", Message: "Order not found" });
    }

    const paymentData = paymentSnap.data() || {};
    const orderId = String(paymentData.orderId || "");
    const expectedAmount = Number(paymentData.amount || 0) * 100;
    const actualAmount = Number(result.vnp_Amount || 0);

    if (expectedAmount !== actualAmount) {
      return res.status(200).json({ RspCode: "04", Message: "Invalid amount" });
    }

    if (paymentData.status === "PAID") {
      return res
        .status(200)
        .json({ RspCode: "02", Message: "Order already confirmed" });
    }

    const isSuccess = responseCode === "00" && transactionStatus === "00";

    await paymentRef.set(
      {
        status: isSuccess ? "PAID" : "UNPAID",
        paidAt: isSuccess ? dayjs().toISOString() : null,
        failedAt: isSuccess ? null : dayjs().toISOString(),
        gatewayResponseCode: responseCode || null,
        gatewayTransactionNo: transactionNo || null,
        gatewayTransactionStatus: transactionStatus || null,
        bankCode: bankCode || null,
        updatedAt: dayjs().toISOString(),
      },
      { merge: true },
    );

    if (orderId) {
      await adminDb
        .collection("Orders")
        .doc(orderId)
        .set(
          {
            statusPayment: isSuccess ? "PAID" : "UNPAID",
            updatedAt: dayjs().toISOString(),
          },
          { merge: true },
        );
    }

    return res.status(200).json({ RspCode: "00", Message: "success" });
  } catch (error) {
    console.error("VNPAY IPN error:", error);
    return res.status(200).json({ RspCode: "99", Message: "Unknown error" });
  }
});

router.post("/retry-from-order/:orderId", async (req, res) => {
  try {
    const orderId = String(req.params.orderId || "").trim();

    if (!orderId) {
      return res.status(400).json({ message: "Thiếu orderId" });
    }

    const orderRef = adminDb.collection("Orders").doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }

    const orderData = orderSnap.data() || {};

    if (String(orderData.typePayment || "") !== "BANK_TRANSFER") {
      return res.status(400).json({ message: "Đơn hàng này không phải thanh toán online" });
    }

    if (String(orderData.statusPayment || "") === "PAID") {
      return res.status(400).json({ message: "Đơn hàng đã thanh toán" });
    }

    if (String(orderData.status || "") === "CANCELLED") {
      return res.status(400).json({ message: "Đơn hàng đã bị hủy" });
    }

    const createdAt = String(orderData.createdAt || "").trim();

    if (!createdAt || !dayjs(createdAt).isValid()) {
      return res.status(400).json({ message: "Đơn hàng không có thời gian tạo hợp lệ" });
    }

    const expireInfo = getExpireInfo(createdAt);

    if (expireInfo.expired) {
      await orderRef.set(
        {
          status: "CANCELLED",
          cancelReason: "Quá 30 phút chưa hoàn tất thanh toán",
          cancelledAt: dayjs().toISOString(),
          updatedAt: dayjs().toISOString(),
        },
        { merge: true },
      );

      return res.status(400).json({
        message: "Đơn hàng đã quá 30 phút và đã bị hủy",
      });
    }

    const newPaymentRef = adminDb.collection("Payments").doc();
    const newPaymentId = newPaymentRef.id;
    const now = dayjs().toISOString();

    await newPaymentRef.set({
      id: newPaymentId,
      orderId,
      idUser: String(orderData.idUser || ""),
      customerName: String(orderData.customerName || ""),
      customerPhone: String(orderData.customerPhone || ""),
      amount: Number(orderData.totalAmount || 0),
      totalProductAmount: Number(orderData.totalProductAmount || 0),
      shipFee: Number(orderData.shipFee || 0),
      status: "UNPAID",
      typePayment: "BANK_TRANSFER",
      source: "ORDER_RETRY",
      paymentGateway: "VNPAY",
      gatewayTxnRef: newPaymentId,
      createdAt: now,
      updatedAt: now,
      paidAt: null,
      failedAt: null,
      gatewayTransactionNo: null,
      gatewayResponseCode: null,
      gatewayTransactionStatus: null,
      gatewayPayDate: null,
      bankCode: null,
    });

    await orderRef.set(
      {
        paymentId: newPaymentId,
        updatedAt: now,
      },
      { merge: true },
    );

    const paymentUrl = createVnpayPaymentUrl({
      amount: Number(orderData.totalAmount || 0),
      txnRef: newPaymentId,
      orderInfo: `Thanh toan don hang ${orderId}`,
      ipAddr: getClientIp(req),
    });

    return res.json({
      orderId,
      paymentId: newPaymentId,
      remainingSeconds: expireInfo.remainingSeconds,
      paymentUrl,
    });
  } catch (error) {
    console.error("retry-from-order error:", error);
    return res.status(500).json({
      message: error instanceof Error ? error.message : "Không tạo được thanh toán lại",
    });
  }
});

router.get("/retry-order-info/:orderId", async (req, res) => {
  try {
    const orderId = String(req.params.orderId || "").trim();

    if (!orderId) {
      return res.status(400).json({ message: "Thiếu orderId" });
    }

    const orderRef = adminDb.collection("Orders").doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }

    const orderData = orderSnap.data() || {};

    if (String(orderData.typePayment || "") !== "BANK_TRANSFER") {
      return res.status(400).json({ message: "Đơn hàng này không phải thanh toán online" });
    }

    if (String(orderData.statusPayment || "") === "PAID") {
      return res.json({
        expired: true,
        remainingSeconds: 0,
        orderId,
        message: "Đơn hàng đã thanh toán thành công",
      });
    }

    if (String(orderData.status || "") === "CANCELLED") {
      return res.json({
        expired: true,
        remainingSeconds: 0,
        orderId,
        message: "Đơn hàng đã bị hủy",
      });
    }

    const createdAt = String(orderData.createdAt || "").trim();

    if (!createdAt || !dayjs(createdAt).isValid()) {
      return res.status(400).json({
        message: "Đơn hàng không có thời gian tạo hợp lệ",
      });
    }

    const expireInfo = getExpireInfo(createdAt);

    if (expireInfo.expired) {
      await orderRef.set(
        {
          status: "CANCELLED",
          cancelReason: "Quá 30 phút chưa hoàn tất thanh toán",
          cancelledAt: dayjs().toISOString(),
          updatedAt: dayjs().toISOString(),
        },
        { merge: true },
      );

      return res.json({
        expired: true,
        remainingSeconds: 0,
        orderId,
        message: "Đơn hàng đã quá 30 phút và đã bị hủy",
      });
    }

    return res.json({
      expired: false,
      remainingSeconds: expireInfo.remainingSeconds,
      orderId,
      amount: Number(orderData.totalAmount || 0),
      customerName: String(orderData.customerName || ""),
      customerPhone: String(orderData.customerPhone || ""),
      message: "Bạn có thể tiếp tục thanh toán đơn hàng này",
    });
  } catch (error) {
    console.error("retry-order-info error:", error);
    return res.status(500).json({
      message: error instanceof Error ? error.message : "Không lấy được thông tin thanh toán lại",
    });
  }
});
export default router;
