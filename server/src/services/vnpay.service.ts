import { VNPay, ignoreLogger } from "vnpay";

export const vnpay = new VNPay({
  tmnCode: (process.env.VNP_TMN_CODE || "").trim(),
  secureSecret: (process.env.VNP_HASH_SECRET || "").trim(),
  vnpayHost: "https://sandbox.vnpayment.vn",
  testMode: true,
  hashAlgorithm: "SHA512",
  enableLog: true,
  loggerFn: ignoreLogger,
});

export function createVnpayPaymentUrl(params: {
  amount: number;
  txnRef: string;
  orderInfo: string;
  ipAddr: string;
  bankCode?: string;
}) {
  return vnpay.buildPaymentUrl({
    vnp_Amount: Math.round(Number(params.amount || 0)),
    vnp_TxnRef: String(params.txnRef),
    vnp_OrderInfo: String(params.orderInfo),
    vnp_IpAddr: String(params.ipAddr || "127.0.0.1"),
    vnp_ReturnUrl: (process.env.VNP_RETURN_URL || "").trim(),
    vnp_Locale: "vn",
    vnp_OrderType: "other",
    vnp_BankCode: params.bankCode || undefined,
  });
}

export function verifyVnpayReturnUrl(
  query: Record<string, string | string[] | undefined>,
) {
  return vnpay.verifyReturnUrl(query);
}

export function verifyVnpayIpnCall(
  query: Record<string, string | string[] | undefined>,
) {
  return vnpay.verifyIpnCall(query);
}
