import express from "express";
import dayjs from "dayjs";
import { adminDb } from "../services/firebase_admin";
import {
  createVnpayPaymentUrl,
  verifyVnpayReturnUrl,
  verifyVnpayIpnCall,
} from "../services/vnpay.service";

const router = express.Router();

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
        error instanceof Error ? error.message : "Không tạo được URL thanh toán",
    });
  }
});

// router.get("/vnpay_return", async (req, res) => {
//   try {
//     const result = verifyVnpayReturnUrl(req.query);
//     console.log("VNPAY RETURN:", result);

//     const ok = result.isSuccess;

//     const paymentId = String(req.query.vnp_TxnRef || "");
//     const responseCode = String(req.query.vnp_ResponseCode || "");
//     const transactionStatus = String(req.query.vnp_TransactionStatus || "");

//     return res.redirect(
//       `${process.env.APP_BASE_URL || "http://localhost:3000"}/checkout?status=${ok ? "success" : "failed"}&paymentId=${encodeURIComponent(paymentId)}&responseCode=${encodeURIComponent(responseCode)}&transactionStatus=${encodeURIComponent(transactionStatus)}`,
//     );
//   } catch (error) {
//     console.error("VNPAY return error:", error);
//     return res.redirect(
//       `${process.env.APP_BASE_URL || "http://localhost:3000"}/checkout?status=error`,
//     );
//   }
// });

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
          await adminDb.collection("Orders").doc(orderId).set(
            {
              statusPayment: ok ? "PAID" : "UNPAID",
              updatedAt: dayjs().toISOString(),
            },
            { merge: true },
          );
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
      return res.status(200).json({ RspCode: "97", Message: "Invalid signature" });
    }

    const paymentId = String(result.vnp_TxnRef || "");
    const responseCode = String(result.vnp_ResponseCode || "");
    const transactionStatus = String(result.vnp_TransactionStatus || "");
    const transactionNo = String(result.vnp_TransactionNo || "");
    const bankCode = String(result.vnp_BankCode || "");

    if (!paymentId) {
      return res.status(200).json({ RspCode: "01", Message: "Order not found" });
    }

    const paymentRef = adminDb.collection("Payments").doc(paymentId);
    const paymentSnap = await paymentRef.get();

    if (!paymentSnap.exists) {
      return res.status(200).json({ RspCode: "01", Message: "Order not found" });
    }

    const paymentData = paymentSnap.data() || {};
    const orderId = String(paymentData.orderId || "");
    const expectedAmount = Number(paymentData.amount || 0) * 100;
    const actualAmount = Number(result.vnp_Amount || 0);

    if (expectedAmount !== actualAmount) {
      return res.status(200).json({ RspCode: "04", Message: "Invalid amount" });
    }

    if (paymentData.status === "PAID") {
      return res.status(200).json({ RspCode: "02", Message: "Order already confirmed" });
    }

    const isSuccess = responseCode =="00" && transactionStatus == "00";

    console.log("VNPAY IPN details:", {
      paymentId,
      orderId,
      expectedAmount,
      actualAmount,
      responseCode,
      transactionStatus,
    }); 
    console.log("Marking payment as:", isSuccess ? "PAID" : "FAILED", isSuccess);

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
      await adminDb.collection("Orders").doc(orderId).set(
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

export default router;