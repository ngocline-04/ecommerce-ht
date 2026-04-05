import React, { useMemo, useState } from "react";
import {
  Button,
  Card,
  Divider,
  List,
  message,
  Result,
  Spin,
  Tag,
  Typography,
  Empty,
} from "antd";
import { useNavigate, useLocation } from "react-router-dom";
import dayjs from "dayjs";

import {
  createOrder,
  formatCurrency,
  updatePromotionStatsForOrder,
  updateUserPurchaseStats,
  sendOrderMessageToCustomer,
} from "../../services/order.service";

const { Title, Text } = Typography;

const VNPAY_API_BASE_URL =
  import.meta.env.VITE_VNPAY_API_BASE_URL || "http://localhost:5001";

const createVnpayPaymentUrl = async (payload: {
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

const CheckoutPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const query = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );

  const paymentStatus = query.get("status");
  const paymentIdFromQuery = query.get("paymentId");
  const responseCode = query.get("responseCode");
  const transactionStatus = query.get("transactionStatus");

  console.log("CheckoutPage query params:", {
    paymentStatus,
    paymentIdFromQuery,
    responseCode,
    transactionStatus,
  });

  const isReturnFromVnpay = Boolean(
    paymentStatus || paymentIdFromQuery || responseCode || transactionStatus,
  );

  const isPaymentSuccess =
    paymentStatus === "success" &&
    responseCode === "00" &&
    transactionStatus === "00";

  const [loading, setLoading] = useState(false);

  const sessionPayloadRaw = sessionStorage.getItem("checkout_pending_payload");
  const sessionPayload = sessionPayloadRaw
    ? JSON.parse(sessionPayloadRaw)
    : null;

  const fallbackState = (location.state || {}) as any;
  const checkoutData = sessionPayload || fallbackState || {};

  const {
    idUser,
    customerName,
    customerPhone,
    typeUser,
    addressShowroom = "",
    addressReceive = "",
    products: selectedProducts = [],
    totalProductAmount = 0,
    shipFee = 0,
    totalAmount: payloadTotalAmount,
    idDVVC = "",
    status = "PENDING_APPROVAL",
    statusPayment = "UNPAID",
    typePayment = "BANK_TRANSFER",
    weight = 0,
    length = 0,
    width = 0,
    height = 0,
    createdAt,
    createdBy,
    cartIds = [],
  } = checkoutData;

  const totalAmount = useMemo(() => {
    if (typeof payloadTotalAmount === "number") return payloadTotalAmount;
    return Number(totalProductAmount || 0) + Number(shipFee || 0);
  }, [payloadTotalAmount, shipFee, totalProductAmount]);

  const hasValidCheckoutData = useMemo(() => {
    return (
      Boolean(idUser) &&
      Array.isArray(selectedProducts) &&
      selectedProducts.length > 0
    );
  }, [idUser, selectedProducts]);

  const totalSelectedQty = useMemo(() => {
    return (selectedProducts || []).reduce(
      (sum: number, item: any) => sum + Number(item.quantity || 0),
      0,
    );
  }, [selectedProducts]);

  const handlePayment = async () => {
    try {
      if (!selectedProducts?.length) {
        message.error("Không có sản phẩm để thanh toán");
        return;
      }

      if (!idUser) {
        message.error("Không tìm thấy thông tin người dùng");
        return;
      }

      setLoading(true);

      const orderPayload = {
        idUser,
        customerName,
        customerPhone,
        typeUser,
        addressShowroom,
        addressReceive,
        products: selectedProducts,
        totalProductAmount: Number(totalProductAmount || 0),
        shipFee: Number(shipFee || 0),
        totalAmount: Number(totalAmount || 0),
        idDVVC,
        status,
        statusPayment: "UNPAID",
        typePayment,
        weight: Number(weight || 0),
        length: Number(length || 0),
        width: Number(width || 0),
        height: Number(height || 0),
        createdAt: createdAt || dayjs().toISOString(),
        createdBy: createdBy || idUser,
      };

      const createdOrder = await createOrder(orderPayload as any);

      await Promise.all([
        updateUserPurchaseStats({
          userId: idUser,
          orderId: createdOrder.id,
          totalAmount: Number(totalAmount || 0),
          usersByPhone: [],
        }),
        updatePromotionStatsForOrder({
          products: selectedProducts,
          promotions: [],
        }),
        sendOrderMessageToCustomer({
          userId: idUser,
          customerName,
          products: selectedProducts,
          orderId: createdOrder.id,
        }),
      ]);

      const paymentRes = await createVnpayPaymentUrl({
        orderId: createdOrder.id,
        paymentId: createdOrder.paymentId,
        userId: idUser,
        customerName,
        customerPhone,
        totalProductAmount: Number(totalProductAmount || 0),
        shipFee: Number(shipFee || 0),
        amount: Number(totalAmount || 0),
      });

      sessionStorage.setItem(
        "vnpay_checkout_context",
        JSON.stringify({
          orderId: createdOrder.id,
          paymentId: createdOrder.paymentId,
          cartIds,
        }),
      );

      // KHÔNG xóa ở đây, vì khi quay lại từ VNPAY page còn cần dữ liệu để render
      window.location.href = paymentRes.paymentUrl;
    } catch (err) {
      console.error(err);
      message.error(
        err instanceof Error ? err.message : "Khởi tạo thanh toán thất bại",
      );
    } finally {
      setLoading(false);
    }
  };

  if (isReturnFromVnpay) {
    return (
      <Result
        status={isPaymentSuccess ? "success" : "error"}
        title={
          isPaymentSuccess ? "Thanh toán thành công" : "Thanh toán thất bại"
        }
        subTitle={
          isPaymentSuccess
            ? `Mã thanh toán: ${paymentIdFromQuery || "-"}`
            : `Mã phản hồi: ${responseCode || "-"} | Trạng thái giao dịch: ${transactionStatus || "-"}`
        }
        extra={[
          <Button
            type="primary"
            onClick={() => {
              sessionStorage.removeItem("checkout_pending_payload");
              sessionStorage.removeItem("vnpay_checkout_context");
              navigate("/cart");
            }}
          >
            Quay lại giỏ hàng
          </Button>,
        ]}
      />
    );
  }
  if (!hasValidCheckoutData) {
    return (
      <Result
        status="warning"
        title="Không có dữ liệu checkout"
        subTitle="Vui lòng quay lại giỏ hàng và chọn sản phẩm cần thanh toán"
        extra={[
          <Button type="primary" onClick={() => navigate("/cart")}>
            Quay lại giỏ hàng
          </Button>,
        ]}
      />
    );
  }

  return (
    <div className="block-content">
      <Card bordered={false} className="mb-24">
        <Title level={3} className="!mb-0">
          Xác nhận thanh toán
        </Title>
      </Card>

      <RowSection
        title="Thông tin nhận hàng"
        content={
          <div>
            <div className="mb-8 flex justify-between gap-16">
              <span className="text-color-700">Khách hàng</span>
              <span className="font-medium text-color-900">
                {customerName || "-"}
              </span>
            </div>

            <div className="mb-8 flex justify-between gap-16">
              <span className="text-color-700">Số điện thoại</span>
              <span className="font-medium text-color-900">
                {customerPhone || "-"}
              </span>
            </div>

            <div className="mb-8 flex justify-between gap-16">
              <span className="text-color-700">Địa chỉ nhận</span>
              <span className="text-right font-medium text-color-900">
                {addressReceive || "-"}
              </span>
            </div>

            <div className="mb-8 flex justify-between gap-16">
              <span className="text-color-700">Hình thức thanh toán</span>
              <span className="font-medium text-color-900">
                {typePayment === "BANK_TRANSFER" ? "VNPAY" : typePayment}
              </span>
            </div>

            <div className="flex justify-between gap-16">
              <span className="text-color-700">Loại khách hàng</span>
              <span className="font-medium text-color-900">
                {typeUser || "-"}
              </span>
            </div>
          </div>
        }
      />

      <RowSection
        title="Sản phẩm đã chọn"
        content={
          selectedProducts?.length ? (
            <List
              dataSource={selectedProducts}
              renderItem={(item: any) => (
                <List.Item>
                  <div className="flex w-full justify-between gap-16">
                    <div className="flex-1">
                      <div className="font-medium text-color-900">
                        {item.name}
                      </div>

                      {item.variantLabel ? (
                        <div className="mt-4">
                          <Text type="secondary">{item.variantLabel}</Text>
                        </div>
                      ) : null}

                      {item.promotion?.campaignName ? (
                        <div className="mt-8">
                          <Tag color="red">{item.promotion.campaignName}</Tag>
                        </div>
                      ) : null}
                    </div>

                    <div className="text-right">
                      <div className="text-color-700">
                        {formatCurrency(Number(item.unitPrice || 0))} x{" "}
                        {Number(item.quantity || 0)}
                      </div>
                      <div className="font-medium text-color-900">
                        {formatCurrency(Number(item.lineTotal || 0))}
                      </div>
                    </div>
                  </div>
                </List.Item>
              )}
            />
          ) : (
            <Empty description="Không có sản phẩm" />
          )
        }
      />

      <RowSection
        title="Tóm tắt thanh toán"
        content={
          <div>
            <div className="mb-8 flex justify-between gap-16">
              <span className="text-color-700">Số lượng sản phẩm</span>
              <span className="font-medium text-color-900">
                {totalSelectedQty}
              </span>
            </div>

            <div className="mb-8 flex justify-between gap-16">
              <span className="text-color-700">Tiền hàng</span>
              <span className="font-medium text-color-900">
                {formatCurrency(Number(totalProductAmount || 0))}
              </span>
            </div>

            <div className="mb-8 flex justify-between gap-16">
              <span className="text-color-700">Phí ship</span>
              <span className="font-medium text-color-900">
                {formatCurrency(Number(shipFee || 0))}
              </span>
            </div>

            <Divider />

            <div className="flex justify-between gap-16 text-18 font-semibold">
              <span className="text-color-900">Tổng thanh toán</span>
              <span className="text-primary-500">
                {formatCurrency(Number(totalAmount || 0))}
              </span>
            </div>

            <div className="mt-16">
              <Tag color="blue">Thanh toán online qua VNPAY</Tag>
            </div>

            <div className="mt-8 text-13 text-color-700">
              Sau khi bấm xác nhận, bạn sẽ được chuyển sang cổng thanh toán
              VNPAY.
            </div>

            <div className="mt-20 flex gap-12 mobile:flex-col">
              <Button
                size="large"
                onClick={() => navigate("/cart")}
                disabled={loading}
              >
                Quay lại giỏ hàng
              </Button>

              <Button
                type="primary"
                size="large"
                onClick={handlePayment}
                disabled={!selectedProducts?.length || loading}
              >
                {loading ? <Spin size="small" /> : "Xác nhận và thanh toán"}
              </Button>
            </div>
          </div>
        }
      />
    </div>
  );
};

const RowSection = ({
  title,
  content,
}: {
  title: string;
  content: React.ReactNode;
}) => {
  return (
    <Card bordered={false} className="mb-24">
      <Title level={5}>{title}</Title>
      {content}
    </Card>
  );
};

export default CheckoutPage;
