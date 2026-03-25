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

import { clearCartAfterCheckout } from "../../services/cart.service";

const { Title, Text } = Typography;

const CheckoutPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const sessionPayloadRaw = sessionStorage.getItem("checkout_pending_payload");
  const sessionPayload = sessionPayloadRaw ? JSON.parse(sessionPayloadRaw) : null;

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
    statusPayment = "PENDING",
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

      // giả lập cổng thanh toán sandbox
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const orderPayload = {
        idUser,
        customerName,
        customerPhone,
        typeUser,
        addressShowroom,
        addressReceive,
        products: selectedProducts,
        totalProductAmount,
        shipFee,
        totalAmount,
        idDVVC,
        status,
        statusPayment: "PAID",
        typePayment,
        weight,
        length,
        width,
        height,
        createdAt: createdAt || dayjs().toISOString(),
        createdBy: createdBy || idUser,
      };

      const createdOrder = await createOrder(orderPayload);

      await Promise.all([
        updateUserPurchaseStats({
          userId: idUser,
          orderId: createdOrder.id,
          totalAmount,
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

      // xoá cart sau khi thanh toán thành công
      await clearCartAfterCheckout(idUser);

      sessionStorage.removeItem("checkout_pending_payload");

      setSuccess(true);
      message.success("Thanh toán thành công!");
    } catch (err) {
      console.error(err);
      message.error("Thanh toán thất bại");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Result
        status="success"
        title="Thanh toán thành công 🎉"
        subTitle="Đơn hàng của bạn đã được ghi nhận"
        extra={[
          <Button type="primary" onClick={() => navigate("/")}>
            Về trang chủ
          </Button>,
        ]}
      />
    );
  }

  return (
    <div className="p-24">
      <Title level={3}>Thanh toán</Title>

      <Card className="mb-16">
        <Title level={5}>Thông tin nhận hàng</Title>

        <div className="mb-8 flex justify-between">
          <span>Khách hàng</span>
          <span>{customerName || "-"}</span>
        </div>

        <div className="mb-8 flex justify-between">
          <span>Số điện thoại</span>
          <span>{customerPhone || "-"}</span>
        </div>

        <div className="mb-8 flex justify-between">
          <span>Địa chỉ nhận</span>
          <span>{addressReceive || "-"}</span>
        </div>
      </Card>

      <Card className="mb-16">
        <Title level={5}>Sản phẩm</Title>

        {selectedProducts?.length ? (
          <List
            dataSource={selectedProducts}
            renderItem={(item: any) => (
              <List.Item>
                <div className="flex w-full justify-between gap-16">
                  <div>
                    <div>{item.name}</div>
                    {item.variantLabel ? (
                      <Text type="secondary">{item.variantLabel}</Text>
                    ) : null}
                  </div>

                  <div className="text-right">
                    <div>{formatCurrency(item.unitPrice)} x {item.quantity}</div>
                    <div className="font-medium">
                      {formatCurrency(item.lineTotal)}
                    </div>
                  </div>
                </div>
              </List.Item>
            )}
          />
        ) : (
          <Empty description="Không có sản phẩm" />
        )}
      </Card>

      <Card>
        <div className="mb-8 flex justify-between">
          <span>Tiền hàng</span>
          <span>{formatCurrency(totalProductAmount)}</span>
        </div>

        <div className="mb-8 flex justify-between">
          <span>Phí ship</span>
          <span>{formatCurrency(shipFee)}</span>
        </div>

        <Divider />

        <div className="flex justify-between text-18 font-bold">
          <span>Tổng</span>
          <span>{formatCurrency(totalAmount)}</span>
        </div>

        <div className="mt-16">
          <Tag color="blue">Thanh toán online (sandbox)</Tag>
        </div>

        <Button
          type="primary"
          size="large"
          block
          className="mt-16"
          onClick={handlePayment}
          disabled={!selectedProducts?.length}
        >
          {loading ? <Spin /> : "Thanh toán ngay"}
        </Button>
      </Card>
    </div>
  );
};

export default CheckoutPage;