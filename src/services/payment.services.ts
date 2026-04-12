import axios from "axios";

const VNPAY_API_BASE_URL =
  import.meta.env.VITE_VNPAY_API_BASE_URL || "http://localhost:5001";

export const createVnpayPaymentUrl = async (payload: {
  orderId: string;
  paymentId: string;
  userId: string;
  customerName: string;
  customerPhone: string;
  totalProductAmount: number;
  shipFee: number;
  amount: number;
}) => {
  const response = await fetch(
    `${VNPAY_API_BASE_URL}/api/vnpay/create-from-order`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || "Không tạo được URL thanh toán VNPAY");
  }

  return data as {
    orderId: string;
    paymentId: string;
    paymentUrl: string;
  };
};

export const sendCodOrderMail = async (payload: {
  orderId: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  totalAmount: number;
}) => {
  const response = await fetch(
    `${VNPAY_API_BASE_URL}/api/vnpay/send-cod-mail`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
  console.log(
    "Gửi email xác nhận COD cho đơn hàng:",
    payload.orderId,
    "đến:",
    payload.customerEmail,
    response,
  );
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || "Không gửi được email xác nhận COD");
  }

  return data;
};


export const getRetryOrderInfo = async (orderId: string) => {
  const response = await axios.get(
    `${VNPAY_API_BASE_URL}/api/vnpay/retry-order-info/${orderId}`,
  );
  return response.data;
};

export const retryVnpayPaymentFromOrder = async (orderId: string) => {
  const response = await axios.post(
    `${VNPAY_API_BASE_URL}/api/vnpay/retry-from-order/${orderId}`,
  );
  return response.data;
};

