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