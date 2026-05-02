import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Checkbox,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Radio,
  Row,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  Spin,
} from "antd";
import { DeleteOutlined, MinusOutlined, PlusOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { auth, db } from "@/App";
import { toast } from "react-toastify";
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
} from "firebase/firestore";
import dayjs from "dayjs";
import type {
  AppUser,
  OrderDoc,
  OrderStatus,
  PaymentStatus,
  ProductDoc,
  PromotionDoc,
  SelectedOrderProduct,
  UserLevel,
} from "../../services/order.types";
import {
  buildSelectedOrderProduct,
  createOrder,
  formatCurrency,
  sendOrderMessageToCustomer,
  updatePromotionStatsForOrder,
  updateUserPurchaseStats,
} from "../../services/order.service";
import {
  CartPendingItem,
  removeCartPendingItem,
  subscribeCartPending,
  toggleCartPendingChecked,
  updateCartPendingQuantity,
} from "../../services/cart.service";
import {
  createVnpayPaymentUrl,
  sendCodOrderMail,
  retryVnpayPayment,
  getRetryOrderInfo,
  retryVnpayPaymentFromOrder,
} from "@/services/payment.services";
import { formatRemainTime } from "@/utils/common";

const { Text } = Typography;

const AUTO_WHOLESALE_MIN_QTY = 10;
const AUTO_WHOLESALE_MIN_AMOUNT = 30000000;

const normalizeUserLevel = (level?: string): UserLevel => {
  if (level === "BTB") return "BTB";
  if (level === "CTV") return "CTV";
  return "BTC";
};

const getUserLevelLabel = (level?: string) => {
  if (level === "BTB") return "Khách buôn / sỉ";
  if (level === "CTV") return "CTV";
  return "Khách lẻ";
};

const getVariantLabel = (record: any) => {
  if (record?.variantLabel) return record.variantLabel;

  const attributes = record?.variantAttributes || {};
  const values = Object.entries(attributes)
    .map(([key, value]) => `${key}: ${value}`)
    .join(" - ");

  return values || "";
};

const renderOrderStatusTag = (status: OrderStatus) => {
  if (status === "PENDING_APPROVAL") {
    return <Tag color="blue">Chờ phê duyệt</Tag>;
  }
  if (status === "PENDING_SHIPPING") {
    return <Tag color="gold">Đang chờ vận chuyển</Tag>;
  }
  if (status === "SUCCESS") {
    return <Tag color="green">Thành công</Tag>;
  }
  return <Tag color="red">Đã huỷ</Tag>;
};

const canCancelOrder = (status?: OrderStatus) => {
  return status === "PENDING_APPROVAL" || status === "PENDING_SHIPPING";
};

const Component = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [cancelOrderForm] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);

  const [cartItems, setCartItems] = useState<CartPendingItem[]>([]);
  const [products, setProducts] = useState<ProductDoc[]>([]);
  const [promotions, setPromotions] = useState<PromotionDoc[]>([]);
  const [myOrders, setMyOrders] = useState<OrderDoc[]>([]);
  const [currentUserProfile, setCurrentUserProfile] = useState<AppUser | null>(
    null,
  );

  const [detailOrderOpen, setDetailOrderOpen] = useState(false);
  const [cancelOrderOpen, setCancelOrderOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderDoc | null>(null);

  const [retryPaymentOpen, setRetryPaymentOpen] = useState(false);
  const [retryPaymentLoading, setRetryPaymentLoading] = useState(false);
  const [retryPaymentSubmitting, setRetryPaymentSubmitting] = useState(false);
  const [retryPaymentInfo, setRetryPaymentInfo] = useState<{
    paymentId: string;
    orderId: string;
    remainingSeconds: number;
    expired: boolean;
    message?: string;
  } | null>(null);

  useEffect(() => {
    if (!retryPaymentOpen || !retryPaymentInfo || retryPaymentInfo?.expired)
      return;

    const timer = window.setInterval(() => {
      setRetryPaymentInfo((prev) => {
        if (!prev) return prev;

        const nextSeconds = Math.max(0, Number(prev.remainingSeconds || 0) - 1);

        if (nextSeconds <= 0) {
          return {
            ...prev,
            remainingSeconds: 0,
            expired: true,
            message: "Giao dịch đã hết hạn",
          };
        }

        return {
          ...prev,
          remainingSeconds: nextSeconds,
        };
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [retryPaymentInfo, retryPaymentOpen]);

  const bootstrap = useCallback(async () => {
    try {
      setLoading(true);

      if (!auth.currentUser?.email) {
        navigate("/login");
        return;
      }

      const [userSnap, productSnap, promotionSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, "Users"),
            where("email", "==", auth.currentUser.email),
            where("isStaff", "==", false),
          ),
        ),
        getDocs(
          query(collection(db, "Products"), where("status", "==", "AVAILABLE")),
        ),
        getDocs(collection(db, "Promotions")),
      ]);

      const userDoc = userSnap.docs[0];
      const user = userDoc
        ? ({ id: userDoc.id, ...userDoc.data() } as AppUser)
        : null;

      const productDocs = productSnap.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })) as ProductDoc[];

      const promotionDocs = promotionSnap.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })) as PromotionDoc[];

      setCurrentUserProfile(user);
      setProducts(productDocs);
      setPromotions(promotionDocs);

      if (user) {
        form.setFieldsValue({
          customerName: user.name || "",
          customerPhone: user.phoneNumber || "",
          addressReceive: user.address || "",
          typePayment: "COD",
          acceptedTerms: false,
        });

        const ordersSnap = await getDocs(
          query(collection(db, "Orders"), where("idUser", "==", user.id)),
        );

        const orders = ordersSnap.docs
          .map((item) => ({
            id: item.id,
            ...item.data(),
          }))
          .sort(
            (a: any, b: any) =>
              dayjs(b.createdAt || 0).valueOf() -
              dayjs(a.createdAt || 0).valueOf(),
          ) as OrderDoc[];

        setMyOrders(orders);
      }
    } catch (error) {
      console.error(error);
      toast.error("Không tải được dữ liệu");
    } finally {
      setLoading(false);
    }
  }, [form, navigate]);

  const handleOpenRetryPayment = useCallback(
    async (order: OrderDoc) => {
      try {
        if (!order?.id) {
          toast.error("Không tìm thấy mã đơn hàng");
          return;
        }

        setRetryPaymentLoading(true);
        setRetryPaymentOpen(true);
        setRetryPaymentInfo(null);

        const data = await getRetryOrderInfo(order.id);

        setRetryPaymentInfo({
          paymentId: "",
          orderId: String(data.orderId || order.id),
          remainingSeconds: Number(data.remainingSeconds || 0),
          expired: Boolean(data.expired),
          message: String(data.message || ""),
        });

        if (data.expired) {
          toast.warning(data.message || "Đơn hàng đã hết hạn");
          await bootstrap();
        }
      } catch (error: any) {
        console.error(error);
        toast.error(
          error?.response?.data?.message ||
            "Không lấy được thông tin thanh toán lại",
        );
        setRetryPaymentOpen(false);
      } finally {
        setRetryPaymentLoading(false);
      }
    },
    [bootstrap],
  );

  const handleRetryPaymentNow = useCallback(async () => {
    try {
      if (!retryPaymentInfo?.orderId) return;

      if (
        retryPaymentInfo?.expired ||
        Number(retryPaymentInfo.remainingSeconds || 0) <= 0
      ) {
        toast.warning("Giao dịch đã hết hạn, đơn hàng sẽ bị hủy");
        await bootstrap();
        return;
      }

      setRetryPaymentSubmitting(true);

      const data = await retryVnpayPaymentFromOrder(retryPaymentInfo.orderId);

      if (!data?.paymentUrl) {
        toast.error("Không tạo được link thanh toán lại");
        return;
      }

      window.location.href = data.paymentUrl;
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || "Thanh toán lại thất bại");
      setRetryPaymentOpen(false);
      await bootstrap();
    } finally {
      setRetryPaymentSubmitting(false);
    }
  }, [bootstrap, retryPaymentInfo]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (!currentUserProfile?.id) return;

    const unsubscribe = subscribeCartPending(
      currentUserProfile.id,
      setCartItems,
    );
    return () => unsubscribe();
  }, [currentUserProfile?.id]);

  const baseTypeUser = useMemo<UserLevel>(() => {
    return normalizeUserLevel(currentUserProfile?.level);
  }, [currentUserProfile?.level]);

  const buildCartSelectedProduct = useCallback(
    (cartItem: CartPendingItem, typeUser: UserLevel): SelectedOrderProduct => {
      const product = products.find((item) => item.id === cartItem.productId);

      if (!product) {
        return {
          id: cartItem.productId,
          name: cartItem.productName || "",
          image: cartItem.productImage || "",
          category: cartItem.category || "",
          quantity: Number(cartItem.quantity || 1),
          unitPrice: Number(cartItem.unitPrice || 0),
          lineTotal:
            Number(cartItem.quantity || 1) * Number(cartItem.unitPrice || 0),
          promotion: cartItem.promotion || null,
          variantId: (cartItem as any).variantId || "",
          variantIndex:
            typeof (cartItem as any).variantIndex === "number"
              ? Number((cartItem as any).variantIndex)
              : 0,
          variantLabel: (cartItem as any).variantLabel || "",
          variantAttributes: (cartItem as any).variantAttributes || {},
        };
      }

      const selectedPromotion = cartItem.promotion?.campaignId
        ? promotions.find(
            (item) => item.id === cartItem.promotion?.campaignId,
          ) || null
        : null;

      const variantIndex =
        typeof (cartItem as any).variantIndex === "number"
          ? Number((cartItem as any).variantIndex)
          : 0;

      const built = buildSelectedOrderProduct(
        product,
        typeUser,
        promotions,
        selectedPromotion,
        Number(cartItem.quantity || 1),
        variantIndex,
      );

      return {
        ...built,
        quantity: Number(cartItem.quantity || 1),
        lineTotal:
          Number(built.unitPrice || 0) * Number(cartItem.quantity || 1),
        variantId: built.variantId || (cartItem as any).variantId || "",
        variantIndex:
          typeof built.variantIndex === "number"
            ? built.variantIndex
            : variantIndex,
        variantLabel:
          built.variantLabel || (cartItem as any).variantLabel || "",
        variantAttributes:
          built.variantAttributes || (cartItem as any).variantAttributes || {},
      };
    },
    [products, promotions],
  );

  const baseDerivedCheckedItems = useMemo(() => {
    return cartItems
      .filter((item) => item.checked)
      .map((item) => buildCartSelectedProduct(item, baseTypeUser));
  }, [baseTypeUser, buildCartSelectedProduct, cartItems]);

  const baseCheckedTotalQty = useMemo(() => {
    return baseDerivedCheckedItems.reduce(
      (sum, item) => sum + Number(item.quantity || 0),
      0,
    );
  }, [baseDerivedCheckedItems]);

  const baseCheckedTotalAmount = useMemo(() => {
    return baseDerivedCheckedItems.reduce(
      (sum, item) => sum + Number(item.lineTotal || 0),
      0,
    );
  }, [baseDerivedCheckedItems]);

  const autoWholesaleApplied = useMemo(() => {
    return (
      baseTypeUser === "BTC" &&
      baseCheckedTotalQty >= AUTO_WHOLESALE_MIN_QTY &&
      baseCheckedTotalAmount >= AUTO_WHOLESALE_MIN_AMOUNT
    );
  }, [baseCheckedTotalAmount, baseCheckedTotalQty, baseTypeUser]);

  const effectiveTypeUser = useMemo<UserLevel>(() => {
    return autoWholesaleApplied ? "BTB" : baseTypeUser;
  }, [autoWholesaleApplied, baseTypeUser]);

  const derivedCartItems = useMemo(() => {
    return cartItems.map((item) => {
      const derived = buildCartSelectedProduct(item, effectiveTypeUser);

      return {
        ...item,
        ...derived,
        cartId: item.id,
        checked: item.checked,
      };
    });
  }, [buildCartSelectedProduct, cartItems, effectiveTypeUser]);

  const checkedCartItems = useMemo(() => {
    return derivedCartItems.filter((item) => item.checked);
  }, [derivedCartItems]);

  const checkedAll = useMemo(() => {
    return cartItems.length > 0 && cartItems.every((item) => item.checked);
  }, [cartItems]);

  const totalSelectedQty = useMemo(() => {
    return checkedCartItems.reduce(
      (sum, item) => sum + Number(item.quantity || 0),
      0,
    );
  }, [checkedCartItems]);

  const totalProductAmount = useMemo(() => {
    return checkedCartItems.reduce(
      (sum, item) => sum + Number(item.lineTotal || 0),
      0,
    );
  }, [checkedCartItems]);

  const grandTotal = totalProductAmount;

  const handleToggleAll = useCallback(
    async (checked: boolean) => {
      try {
        await Promise.all(
          cartItems.map((item) => toggleCartPendingChecked(item.id, checked)),
        );
      } catch (error) {
        console.error(error);
        toast.error("Cập nhật chọn sản phẩm thất bại");
      }
    },
    [cartItems],
  );

  const handleChangeQuantity = useCallback(
    async (
      record: CartPendingItem &
        SelectedOrderProduct & {
          cartId: string;
        },
      nextQty: number,
    ) => {
      try {
        const safeQty = Math.max(1, Number(nextQty || 1));
        await updateCartPendingQuantity(
          record.cartId,
          safeQty,
          Number(record.unitPrice || 0),
        );
      } catch (error) {
        console.error(error);
        toast.error("Cập nhật số lượng thất bại");
      }
    },
    [],
  );

  // const handleCheckout = useCallback(async () => {
  //   try {
  //     const values = await form.validateFields();

  //     if (!checkedCartItems.length) {
  //       toast.warning("Vui lòng chọn ít nhất 1 sản phẩm để thanh toán");
  //       return;
  //     }

  //     if (!currentUserProfile?.id) {
  //       toast.error("Không tìm thấy thông tin người dùng");
  //       return;
  //     }

  //     const selectedProducts: SelectedOrderProduct[] = checkedCartItems.map(
  //       (item) => ({
  //         id: item.id,
  //         name: item.name,
  //         image: item.image || "",
  //         category: item.category || "",
  //         quantity: Number(item.quantity || 1),
  //         unitPrice: Number(item.unitPrice || 0),
  //         lineTotal: Number(item.lineTotal || 0),
  //         promotion: item.promotion || null,
  //         variantId: item.variantId || "",
  //         variantIndex:
  //           typeof item.variantIndex === "number" ? item.variantIndex : 0,
  //         variantLabel: item.variantLabel || "",
  //         variantAttributes: item.variantAttributes || {},
  //       }),
  //     );

  //     if (values.typePayment === "BANK_TRANSFER") {
  //       sessionStorage.setItem(
  //         "checkout_pending_payload",
  //         JSON.stringify({
  //           idUser: currentUserProfile.id,
  //           customerName: values.customerName,
  //           customerPhone: values.customerPhone,
  //           typeUser: effectiveTypeUser,
  //           addressShowroom: "",
  //           addressReceive: values.addressReceive,
  //           products: selectedProducts,
  //           totalProductAmount,
  //           shipFee: 0,
  //           totalAmount: grandTotal,
  //           idDVVC: "",
  //           status: "PENDING_APPROVAL",
  //           statusPayment: "PENDING",
  //           typePayment: values.typePayment,
  //           weight: 0,
  //           length: 0,
  //           width: 0,
  //           height: 0,
  //           createdAt: new Date().toISOString(),
  //           createdBy: auth.currentUser?.uid || "web_customer",
  //           cartIds: checkedCartItems.map((item) => item.cartId),
  //         }),
  //       );

  //       navigate("/checkout");
  //       return;
  //     }

  //     const paymentStatus: PaymentStatus = "PENDING";

  //     const createdOrder = await createOrder({
  //       idUser: currentUserProfile.id,
  //       customerName: values.customerName,
  //       customerPhone: values.customerPhone,
  //       typeUser: effectiveTypeUser,
  //       addressShowroom: "",
  //       addressReceive: values.addressReceive,
  //       products: selectedProducts,
  //       totalProductAmount,
  //       shipFee: 0,
  //       totalAmount: grandTotal,
  //       idDVVC: "" as any,
  //       status: "PENDING_APPROVAL",
  //       statusPayment: paymentStatus,
  //       typePayment: values.typePayment,
  //       weight: 0,
  //       length: 0,
  //       width: 0,
  //       height: 0,
  //       createdAt: new Date().toISOString(),
  //       createdBy: auth.currentUser?.uid || "web_customer",
  //     });

  //     await Promise.all([
  //       updateUserPurchaseStats({
  //         userId: currentUserProfile.id,
  //         orderId: createdOrder.id,
  //         totalAmount: grandTotal,
  //         usersByPhone: currentUserProfile ? [currentUserProfile] : [],
  //       }),
  //       updatePromotionStatsForOrder({
  //         products: selectedProducts,
  //         promotions,
  //       }),
  //       sendOrderMessageToCustomer({
  //         userId: currentUserProfile.id,
  //         customerName: values.customerName,
  //         products: selectedProducts,
  //         orderId: createdOrder.id,
  //       }),
  //       ...checkedCartItems.map((item) => removeCartPendingItem(item.cartId)),
  //     ]);

  //     toast.success("Đặt hàng COD thành công");
  //     await bootstrap();
  //   } catch (error) {
  //     console.error(error);
  //     toast.error("Thanh toán thất bại");
  //   }
  // }, [
  //   checkedCartItems,
  //   currentUserProfile,
  //   effectiveTypeUser,
  //   form,
  //   grandTotal,
  //   navigate,
  //   promotions,
  //   totalProductAmount,
  //   bootstrap,
  // ]);
  ///cho nay ok
  const handleCheckout = useCallback(async () => {
    try {
      const values = await form.validateFields();

      if (!checkedCartItems.length) {
        toast.warning("Vui lòng chọn ít nhất 1 sản phẩm để thanh toán");
        return;
      }

      console.log(currentUserProfile, "check=====");
      if (!currentUserProfile?.id) {
        toast.error("Không tìm thấy thông tin người dùng");
        return;
      }

      const selectedProducts: SelectedOrderProduct[] = checkedCartItems.map(
        (item) => ({
          id: item.id,
          name: item.name,
          image: item.image || "",
          category: item.category || "",
          quantity: Number(item.quantity || 1),
          unitPrice: Number(item.unitPrice || 0),
          lineTotal: Number(item.lineTotal || 0),
          promotion: item.promotion || null,
          variantId: item.variantId || "",
          variantIndex:
            typeof item.variantIndex === "number" ? item.variantIndex : 0,
          variantLabel: item.variantLabel || "",
          variantAttributes: item.variantAttributes || {},
        }),
      );

      const orderPayload = {
        idUser: currentUserProfile.id,
        customerName: values.customerName,
        customerPhone: values.customerPhone,
        typeUser: effectiveTypeUser,
        addressShowroom: "",
        addressReceive: values.addressReceive,
        products: selectedProducts,
        totalProductAmount,
        shipFee: 0,
        totalAmount: grandTotal,
        idDVVC: "" as any,
        status: "PENDING_APPROVAL",
        statusPayment: "UNPAID" as PaymentStatus,
        typePayment: values.typePayment,
        weight: 0,
        length: 0,
        width: 0,
        height: 0,
        createdAt: new Date().toISOString(),
        createdBy: auth.currentUser?.uid || "web_customer",
      };

      // if (values.typePayment === "COD") {
      //   const createdOrder = await createOrder(orderPayload);

      //   await Promise.all([
      //     updateUserPurchaseStats({
      //       userId: currentUserProfile.id,
      //       orderId: createdOrder.id,
      //       totalAmount: grandTotal,
      //       usersByPhone: currentUserProfile ? [currentUserProfile] : [],
      //     }),
      //     updatePromotionStatsForOrder({
      //       products: selectedProducts,
      //       promotions,
      //     }),
      //     sendOrderMessageToCustomer({
      //       userId: currentUserProfile.id,
      //       customerName: values.customerName,
      //       products: selectedProducts,
      //       orderId: createdOrder.id,
      //     }),
      //     ...checkedCartItems.map((item) => removeCartPendingItem(item.cartId)),
      //   ]);

      //   toast.success("Đặt hàng COD thành công");
      //   await bootstrap();
      //   return;
      // }
      if (values.typePayment === "COD") {
        const createdOrder = await createOrder(orderPayload);

        await Promise.all([
          updateUserPurchaseStats({
            userId: currentUserProfile.id,
            orderId: createdOrder.id,
            totalAmount: grandTotal,
            usersByPhone: currentUserProfile ? [currentUserProfile] : [],
          }),
          updatePromotionStatsForOrder({
            products: selectedProducts,
            promotions,
          }),
          sendOrderMessageToCustomer({
            userId: currentUserProfile.id,
            customerName: values.customerName,
            products: selectedProducts,
            orderId: createdOrder.id,
          }),
          ...checkedCartItems.map((item) => removeCartPendingItem(item.cartId)),
        ]);

        let mailFailedMessage = "";

        try {
          await sendCodOrderMail({
            orderId: createdOrder.id,
            userId: currentUserProfile.id,
            customerName: values.customerName,
            customerEmail:
              (currentUserProfile as any).email ||
              auth.currentUser?.email ||
              "",
            totalAmount: grandTotal,
          });
        } catch (mailError) {
          console.error(mailError);
          mailFailedMessage =
            mailError instanceof Error
              ? `Gửi email xác nhận thất bại: ${mailError.message}`
              : "Gửi email xác nhận thất bại";
        }

        toast.success("Đặt hàng COD thành công");

        if (mailFailedMessage) {
          toast.warning(mailFailedMessage);
        }

        await bootstrap();
        return;
      }
      const createdOrder = await createOrder(orderPayload);

      await Promise.all([
        updateUserPurchaseStats({
          userId: currentUserProfile.id,
          orderId: createdOrder.id,
          totalAmount: grandTotal,
          usersByPhone: currentUserProfile ? [currentUserProfile] : [],
        }),
        updatePromotionStatsForOrder({
          products: selectedProducts,
          promotions,
        }),
        sendOrderMessageToCustomer({
          userId: currentUserProfile.id,
          customerName: values.customerName,
          products: selectedProducts,
          orderId: createdOrder.id,
        }),
        ...checkedCartItems.map((item) => removeCartPendingItem(item.cartId)),
      ]);

      sessionStorage.setItem(
        "vnpay_checkout_context",
        JSON.stringify({
          orderId: createdOrder.id,
          paymentId: createdOrder.paymentId,
        }),
      );

      const paymentRes = await createVnpayPaymentUrl({
        orderId: createdOrder.id,
        paymentId: createdOrder.paymentId,
        userId: currentUserProfile.id,
        customerName: values.customerName,
        customerPhone: values.customerPhone,
        totalProductAmount,
        shipFee: 0,
        amount: grandTotal,
      });

      window.location.href = paymentRes.paymentUrl;
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Thanh toán thất bại",
      );
    }
  }, [
    checkedCartItems,
    currentUserProfile,
    effectiveTypeUser,
    form,
    grandTotal,
    promotions,
    totalProductAmount,
    bootstrap,
  ]);

  // const handleCheckout = useCallback(async () => {
  //   try {
  //     const values = await form.validateFields();

  //     if (!checkedCartItems.length) {
  //       toast.warning("Vui lòng chọn ít nhất 1 sản phẩm để thanh toán");
  //       return;
  //     }

  //     if (!currentUserProfile?.id) {
  //       toast.error("Không tìm thấy thông tin người dùng");
  //       return;
  //     }

  //     const selectedProducts: SelectedOrderProduct[] = checkedCartItems.map(
  //       (item) => ({
  //         id: item.id,
  //         name: item.name,
  //         image: item.image || "",
  //         category: item.category || "",
  //         quantity: Number(item.quantity || 1),
  //         unitPrice: Number(item.unitPrice || 0),
  //         lineTotal: Number(item.lineTotal || 0),
  //         promotion: item.promotion || null,
  //         variantId: item.variantId || "",
  //         variantIndex:
  //           typeof item.variantIndex === "number" ? item.variantIndex : 0,
  //         variantLabel: item.variantLabel || "",
  //         variantAttributes: item.variantAttributes || {},
  //       }),
  //     );

  //     const isCod = values.typePayment === "COD";

  //     const orderPayload = {
  //       idUser: currentUserProfile.id,
  //       customerName: values.customerName,
  //       customerPhone: values.customerPhone,
  //       typeUser: effectiveTypeUser,
  //       addressShowroom: "",
  //       addressReceive: values.addressReceive,
  //       products: selectedProducts,
  //       totalProductAmount,
  //       shipFee: 0,
  //       totalAmount: grandTotal,
  //       idDVVC: "" as any,
  //       status: "PENDING_APPROVAL",
  //       statusPayment: "UNPAID" as PaymentStatus,
  //       typePayment: isCod ? "COD" : "BANK_TRANSFER",
  //       weight: 0,
  //       length: 0,
  //       width: 0,
  //       height: 0,
  //       createdAt: new Date().toISOString(),
  //       createdBy: auth.currentUser?.uid || "web_customer",
  //     };

  //     const createdOrder = await createOrder(orderPayload);

  //     await Promise.all([
  //       updateUserPurchaseStats({
  //         userId: currentUserProfile.id,
  //         orderId: createdOrder.id,
  //         totalAmount: grandTotal,
  //         usersByPhone: currentUserProfile ? [currentUserProfile] : [],
  //       }),
  //       updatePromotionStatsForOrder({
  //         products: selectedProducts,
  //         promotions,
  //       }),
  //       sendOrderMessageToCustomer({
  //         userId: currentUserProfile.id,
  //         customerName: values.customerName,
  //         products: selectedProducts,
  //         orderId: createdOrder.id,
  //       }),
  //       ...checkedCartItems.map((item) => removeCartPendingItem(item.cartId)),
  //     ]);

  //     if (isCod) {
  //       toast.success("Đặt hàng COD thành công");
  //       await bootstrap();
  //       return;
  //     }

  //     sessionStorage.setItem(
  //       "vnpay_checkout_context",
  //       JSON.stringify({
  //         orderId: createdOrder.id,
  //         paymentId: createdOrder.paymentId,
  //       }),
  //     );

  //     const paymentRes = await createVnpayPaymentUrl({
  //       orderId: createdOrder.id,
  //       paymentId: createdOrder.paymentId,
  //       userId: currentUserProfile.id,
  //       customerName: values.customerName,
  //       customerPhone: values.customerPhone,
  //       totalProductAmount,
  //       shipFee: 0,
  //       amount: grandTotal,
  //     });

  //     window.location.href = paymentRes.paymentUrl;
  //   } catch (error) {
  //     console.error(error);
  //     toast.error(
  //       error instanceof Error ? error.message : "Thanh toán thất bại",
  //     );
  //   }
  // }, [
  //   checkedCartItems,
  //   currentUserProfile,
  //   effectiveTypeUser,
  //   form,
  //   grandTotal,
  //   promotions,
  //   totalProductAmount,
  //   bootstrap,
  // ]);
  const openOrderDetail = useCallback((order: OrderDoc) => {
    setSelectedOrder(order);
    setDetailOrderOpen(true);
  }, []);

  const openCancelOrder = useCallback(
    (order: OrderDoc) => {
      setSelectedOrder(order);
      cancelOrderForm.resetFields();
      setCancelOrderOpen(true);
    },
    [cancelOrderForm],
  );

  const handleCancelMyOrder = useCallback(async () => {
    try {
      const values = await cancelOrderForm.validateFields();

      if (!selectedOrder?.id) return;

      await updateDoc(doc(db, "Orders", selectedOrder.id), {
        status: "CANCELLED",
        cancelReason: values.cancelReason,
        cancelledAt: dayjs().toISOString(),
        cancelledBy: currentUserProfile?.id || "",
        updatedAt: dayjs().toISOString(),
      });

      toast.success("Huỷ đơn hàng thành công");
      setCancelOrderOpen(false);
      setSelectedOrder(null);
      cancelOrderForm.resetFields();
      await bootstrap();
    } catch (error) {
      console.error(error);
      toast.error("Huỷ đơn hàng thất bại");
    }
  }, [bootstrap, cancelOrderForm, currentUserProfile?.id, selectedOrder]);

  const cartColumns = [
    {
      title: (
        <Checkbox
          checked={checkedAll}
          onChange={(e) => handleToggleAll(e.target.checked)}
        />
      ),
      width: 60,
      render: (_: unknown, record: any) => (
        <Checkbox
          checked={record.checked}
          onChange={(e) =>
            toggleCartPendingChecked(record.cartId, e.target.checked)
          }
        />
      ),
    },
    {
      title: "Sản phẩm",
      render: (_: unknown, record: any) => (
        <div className="flex items-center">
          <img
            src={record.image}
            style={{ width: 56, height: 56, objectFit: "cover" }}
          />
          <div className="ml-12">
            <div>{record.name}</div>
            <div className="text-12 text-color-700">{record.id}</div>
            {getVariantLabel(record) ? (
              <div className="mt-4 text-12 text-color-700">
                {getVariantLabel(record)}
              </div>
            ) : null}
            {record.promotion ? (
              <div className="mt-4">
                <Tag color="red">{record.promotion.campaignName}</Tag>
              </div>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      title: "Giá",
      dataIndex: "unitPrice",
      width: 150,
      render: (value: number) => formatCurrency(value),
    },
    {
      title: "Số lượng",
      width: 210,
      render: (_: unknown, record: any) => (
        <Space.Compact>
          <Button
            icon={<MinusOutlined />}
            onClick={() =>
              handleChangeQuantity(record, Number(record.quantity || 1) - 1)
            }
          />
          <InputNumber
            min={1}
            value={record.quantity}
            onChange={(value) =>
              handleChangeQuantity(record, Number(value || 1))
            }
            style={{ width: 80 }}
          />
          <Button
            icon={<PlusOutlined />}
            onClick={() =>
              handleChangeQuantity(record, Number(record.quantity || 1) + 1)
            }
          />
        </Space.Compact>
      ),
    },
    {
      title: "Khuyến mại",
      width: 220,
      render: (_: unknown, record: any) =>
        record.promotion ? (
          <div>
            <div>{record.promotion.campaignName}</div>
            <div className="text-12 text-color-700">
              {record.promotion.discountType === "percent"
                ? `${record.promotion.discountValue}%`
                : formatCurrency(record.promotion.discountValue)}
            </div>
          </div>
        ) : (
          <Text type="secondary">Không áp dụng</Text>
        ),
    },
    {
      title: "Thành tiền",
      dataIndex: "lineTotal",
      width: 150,
      render: (value: number) => formatCurrency(value),
    },
    {
      title: "",
      width: 80,
      render: (_: unknown, record: any) => (
        <Popconfirm
          title="Xoá sản phẩm khỏi giỏ hàng?"
          onConfirm={() => removeCartPendingItem(record.cartId)}
        >
          <Button danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  const renderPaymentStatusText = (
    status?: PaymentStatus | "FAILED",
    typePayment?: string,
  ) => {
    if (status === "PAID") return "Đã thanh toán";
    if (status === "FAILED") return "Thanh toán thất bại";
    if (typePayment === "COD") return "Thanh toán khi nhận hàng";
    return "Chưa thanh toán";
  };

  const orderColumns = [
    {
      title: "Mã đơn",
      dataIndex: "id",
      width: 180,
    },
    {
      title: "Ngày tạo",
      dataIndex: "createdAt",
      width: 160,
      render: (value: string) => dayjs(value).format("DD/MM/YYYY HH:mm"),
    },
    {
      title: "Tổng tiền",
      dataIndex: "totalAmount",
      width: 150,
      render: (value: number) => formatCurrency(value),
    },
    {
      title: "Thanh toán",
      width: 180,
      render: (_: unknown, record: OrderDoc) => (
        <div>
          <div>
            {record.typePayment === "COD"
              ? "Thanh toán khi nhận hàng"
              : "Chuyển khoản"}
          </div>
          <div className="text-12 text-color-700">
            {renderPaymentStatusText(record.statusPayment as any)}
          </div>
        </div>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      width: 160,
      render: (value: OrderStatus) => renderOrderStatusTag(value),
    },
    {
      title: "Thao tác",
      width: 320,
      render: (_: unknown, record: OrderDoc) => {
        const canRetryPayment =
          record.typePayment === "BANK_TRANSFER" &&
          record.statusPayment !== "PAID" &&
          record.status !== "CANCELLED";

        return (
          <Space wrap>
            <Button size="small" onClick={() => openOrderDetail(record)}>
              Chi tiết
            </Button>

            {canRetryPayment ? (
              <Button
                size="small"
                type="primary"
                onClick={() => handleOpenRetryPayment(record)}
              >
                Thanh toán lại
              </Button>
            ) : null}

            {canCancelOrder(record.status) ? (
              <Button
                danger
                size="small"
                onClick={() => openCancelOrder(record)}
              >
                Huỷ đơn
              </Button>
            ) : null}
          </Space>
        );
      },
    },
  ];

  return (
    <div className="block-content">
      <Tabs
        defaultActiveKey="cart"
        items={[
          {
            key: "cart",
            label: "Giỏ hàng",
            children: (
              <Card title="Giỏ hàng của bạn">
                <Form form={form} layout="vertical" autoComplete="off">
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item
                        label="Tên khách hàng"
                        name="customerName"
                        rules={[
                          {
                            required: true,
                            message: "Vui lòng nhập tên khách hàng",
                          },
                        ]}
                      >
                        <Input className="h-40" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item
                        label="Số điện thoại"
                        name="customerPhone"
                        rules={[
                          {
                            required: true,
                            message: "Vui lòng nhập số điện thoại",
                          },
                        ]}
                      >
                        <Input className="h-40" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="Loại khách hàng">
                        <div className="flex h-40 items-center rounded-radius-m border border-color-500 px-12">
                          {getUserLevelLabel(baseTypeUser)}
                        </div>
                      </Form.Item>
                    </Col>
                  </Row>

                  {autoWholesaleApplied ? (
                    <div className="mb-16">
                      <Tag color="green">Áp dụng ưu đãi giá buôn</Tag>
                    </div>
                  ) : null}

                  <Row gutter={16}>
                    <Col span={24}>
                      <Form.Item
                        name="addressReceive"
                        label="Địa chỉ nhận hàng"
                        rules={[
                          {
                            required: true,
                            message: "Vui lòng nhập địa chỉ nhận hàng",
                          },
                        ]}
                      >
                        <Input className="h-40" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Divider orientation="left">Sản phẩm trong giỏ</Divider>

                  <Table
                    rowKey="cartId"
                    bordered
                    loading={loading}
                    dataSource={derivedCartItems}
                    pagination={false}
                    locale={{ emptyText: "Giỏ hàng đang trống" }}
                    columns={cartColumns as any}
                  />

                  <Divider orientation="left">Thanh toán</Divider>

                  <Row gutter={16}>
                    <Col span={24}>
                      <Form.Item
                        name="typePayment"
                        label="Hình thức thanh toán"
                        rules={[
                          {
                            required: true,
                            message: "Vui lòng chọn hình thức thanh toán",
                          },
                        ]}
                      >
                        <Radio.Group>
                          <Radio value="COD">Thanh toán khi nhận hàng</Radio>
                          <Radio value="BANK_TRANSFER">
                            Thanh toán trực tuyến
                          </Radio>
                        </Radio.Group>
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item
                    name="acceptedTerms"
                    valuePropName="checked"
                    rules={[
                      {
                        validator: (_, value) =>
                          value
                            ? Promise.resolve()
                            : Promise.reject(
                                new Error(
                                  "Vui lòng đồng ý với điều khoản và điều kiện của website",
                                ),
                              ),
                      },
                    ]}
                  >
                    <Checkbox>
                      Tôi đã đọc và đồng ý với điều khoản và điều kiện của
                      website
                    </Checkbox>
                  </Form.Item>

                  <div className="mb-16 text-14 leading-24 text-color-700">
                    Thông tin cá nhân của bạn sẽ được sử dụng để xử lý đơn hàng,
                    tăng trải nghiệm sử dụng website và cho các mục đích cụ thể
                    khác đã được mô tả trong{" "}
                    <button
                      type="button"
                      className="text-link-500 underline"
                      onClick={() => setPolicyOpen(true)}
                    >
                      chính sách riêng tư
                    </button>{" "}
                    của chúng tôi.
                  </div>

                  <Card size="small" className="mt-16">
                    <Row gutter={16}>
                      <Col span={12}>
                        <div className="text-14 text-color-700">
                          Số lượng đã chọn
                        </div>
                        <div className="text-18 font-semibold">
                          {totalSelectedQty}
                        </div>
                      </Col>
                      <Col span={12}>
                        <div className="text-14 text-color-700">Tiền hàng</div>
                        <div className="text-18 font-semibold">
                          {formatCurrency(totalProductAmount)}
                        </div>
                      </Col>
                    </Row>

                    <Divider />

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-14 text-color-700">
                          Tổng thanh toán
                        </div>
                        <div className="text-24 font-semibold text-primary-500">
                          {formatCurrency(grandTotal)}
                        </div>
                      </div>

                      <Button
                        size="large"
                        type="primary"
                        disabled={!checkedCartItems.length}
                        onClick={handleCheckout}
                      >
                        Thanh toán
                      </Button>
                    </div>
                  </Card>
                </Form>
              </Card>
            ),
          },
          {
            key: "orders",
            label: "Đơn hàng của tôi",
            children: (
              <Card title="Danh sách đơn hàng của tôi">
                <Table
                  rowKey="id"
                  bordered
                  loading={loading}
                  dataSource={myOrders}
                  columns={orderColumns as any}
                  scroll={{ x: 1000 }}
                  pagination={{
                    pageSize: 10,
                    showSizeChanger: true,
                    pageSizeOptions: ["10", "20", "50"],
                    showTotal: (total) => `Tổng ${total} đơn hàng`,
                  }}
                />
              </Card>
            ),
          },
        ]}
      />

      <Modal
        title="Chi tiết đơn hàng"
        open={detailOrderOpen}
        width={1000}
        footer={null}
        onCancel={() => setDetailOrderOpen(false)}
      >
        {selectedOrder ? (
          <div>
            <Row gutter={16}>
              <Col span={12}>
                <div className="mb-8 font-medium">
                  Mã đơn: {selectedOrder.id}
                </div>
                <div>Khách hàng: {selectedOrder.customerName}</div>
                <div>SĐT: {selectedOrder.customerPhone}</div>
                <div>
                  Loại khách: {getUserLevelLabel(selectedOrder.typeUser)}
                </div>
                <div>Địa chỉ nhận: {selectedOrder.addressReceive}</div>
              </Col>
              <Col span={12}>
                <div>
                  Trạng thái: {renderOrderStatusTag(selectedOrder.status)}
                </div>
                <div>
                  Thanh toán:{" "}
                  {selectedOrder.typePayment === "COD" ? "COD" : "Chuyển khoản"}
                </div>
                <div>
                  Trạng thái thanh toán:{" "}
                  {renderPaymentStatusText(selectedOrder.statusPayment as any)}
                </div>
                {selectedOrder.cancelReason ? (
                  <div>Lý do huỷ: {selectedOrder.cancelReason}</div>
                ) : null}
                <div>
                  Ngày tạo:{" "}
                  {dayjs(selectedOrder.createdAt).format("DD/MM/YYYY HH:mm")}
                </div>
              </Col>
            </Row>

            <Divider />

            <Table
              rowKey={(record: any, index) =>
                `${record.id}_${record.variantId || ""}_${index}`
              }
              bordered
              pagination={false}
              dataSource={selectedOrder.products || []}
              columns={[
                {
                  title: "Sản phẩm",
                  render: (_: unknown, record: any) => (
                    <div>
                      <div>{record.name}</div>
                      {record.variantLabel ? (
                        <div className="text-12 text-color-700">
                          {record.variantLabel}
                        </div>
                      ) : null}
                    </div>
                  ),
                },
                {
                  title: "Giá",
                  dataIndex: "unitPrice",
                  render: (value: number) => formatCurrency(value),
                },
                { title: "SL", dataIndex: "quantity" },
                {
                  title: "Thành tiền",
                  dataIndex: "lineTotal",
                  render: (value: number) => formatCurrency(value),
                },
              ]}
            />

            <Divider />

            <div className="flex justify-end">
              <div className="w-[320px] rounded-radius-m bg-color-100 p-16">
                <div className="mb-8 flex justify-between">
                  <span>Tiền hàng</span>
                  <span>
                    {formatCurrency(selectedOrder.totalProductAmount)}
                  </span>
                </div>
                <div className="mb-8 flex justify-between">
                  <span>Phí ship</span>
                  <span>{formatCurrency(selectedOrder.shipFee)}</span>
                </div>
                <div className="flex justify-between text-16 font-semibold text-primary-500">
                  <span>Tổng cộng</span>
                  <span>{formatCurrency(selectedOrder.totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        title="Huỷ đơn hàng"
        open={cancelOrderOpen}
        width={700}
        footer={null}
        onCancel={() => setCancelOrderOpen(false)}
      >
        {selectedOrder ? (
          <>
            <div className="mb-16 rounded-radius-m bg-color-100 p-16">
              <div className="font-medium">Đơn hàng: {selectedOrder.id}</div>
              <div>Tổng tiền: {formatCurrency(selectedOrder.totalAmount)}</div>
            </div>

            <Form form={cancelOrderForm} layout="vertical">
              <Form.Item
                name="cancelReason"
                label="Lý do huỷ đơn"
                rules={[
                  { required: true, message: "Vui lòng nhập lý do huỷ đơn" },
                ]}
              >
                <Input.TextArea rows={4} placeholder="Nhập lý do huỷ đơn" />
              </Form.Item>

              <div className="flex justify-end gap-12">
                <Button onClick={() => setCancelOrderOpen(false)}>Đóng</Button>
                <Button danger type="primary" onClick={handleCancelMyOrder}>
                  Xác nhận huỷ đơn
                </Button>
              </div>
            </Form>
          </>
        ) : null}
      </Modal>

      <Modal
        title="Chính sách riêng tư"
        open={policyOpen}
        width={900}
        footer={null}
        onCancel={() => setPolicyOpen(false)}
      >
        <div className="max-h-[70vh] overflow-auto text-14 leading-24 text-color-800">
          <p>
            Chúng tôi cam kết bảo vệ thông tin cá nhân của khách hàng khi sử
            dụng website và mua sắm trực tuyến.
          </p>

          <p>
            Thông tin cá nhân của bạn có thể được sử dụng để xác nhận đơn hàng,
            giao hàng, chăm sóc khách hàng, hỗ trợ sau bán và cải thiện trải
            nghiệm sử dụng website.
          </p>

          <p>
            Chúng tôi không chia sẻ thông tin cá nhân của khách hàng cho bên thứ
            ba ngoài phạm vi cần thiết để hoàn tất giao dịch, vận chuyển và các
            nghĩa vụ pháp lý liên quan.
          </p>

          <p>
            Khi sử dụng website, bạn đồng ý cho chúng tôi lưu trữ và xử lý dữ
            liệu cần thiết nhằm phục vụ việc đặt hàng, thanh toán và hỗ trợ
            khách hàng.
          </p>

          <div className="mt-16 flex justify-end">
            <Button onClick={() => setPolicyOpen(false)}>Đóng</Button>
          </div>
        </div>
      </Modal>

      <Modal
        title="Thanh toán lại đơn hàng"
        open={retryPaymentOpen}
        width={560}
        footer={null}
        destroyOnClose
        onCancel={() => {
          setRetryPaymentOpen(false);
          setRetryPaymentInfo(null);
        }}
      >
        {retryPaymentLoading ? (
          <div className="flex min-h-[180px] items-center justify-center">
            <Spin />
          </div>
        ) : retryPaymentInfo ? (
          <div>
            <div className="mb-16 rounded-radius-m bg-color-100 p-16">
              <div className="mb-8">
                <span className="font-medium">Mã đơn:</span>{" "}
                {retryPaymentInfo.orderId}
              </div>
              <div className="mb-8">
                <span className="font-medium">Mã thanh toán:</span>{" "}
                {retryPaymentInfo.paymentId}
              </div>
              <div>
                <span className="font-medium">Thời gian còn lại:</span>{" "}
                {retryPaymentInfo?.expired
                  ? "Đã hết hạn"
                  : formatRemainTime(retryPaymentInfo.remainingSeconds)}
              </div>
            </div>

            {retryPaymentInfo?.expired ? (
              <div className="mb-16 rounded-radius-m border border-error-300 bg-error-50 p-16 text-error-600">
                {retryPaymentInfo.message ||
                  "Giao dịch đã quá 30 phút. Đơn hàng đã bị hủy."}
              </div>
            ) : (
              <div className="mb-16 rounded-radius-m border border-primary-300 bg-primary-50 p-16">
                <div className="font-medium text-color-900">
                  Bạn vẫn có thể tiếp tục thanh toán đơn hàng này.
                </div>
                <div className="mt-4 text-13 text-color-700">
                  Nếu quá 30 phút kể từ thời điểm tạo payment mà chưa thanh toán
                  thành công, hệ thống sẽ tự hủy đơn.
                </div>
              </div>
            )}

            <div className="flex justify-end gap-12">
              <Button
                onClick={() => {
                  setRetryPaymentOpen(false);
                  setRetryPaymentInfo(null);
                }}
              >
                Đóng
              </Button>

              {!retryPaymentInfo?.expired ? (
                <Button
                  type="primary"
                  loading={retryPaymentSubmitting}
                  onClick={handleRetryPaymentNow}
                >
                  Thanh toán ngay
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

const CartPage = memo(Component);

export default CartPage;
