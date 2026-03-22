export type UserLevel = "BTC" | "BTB" | "CTV";
export type OrderStatus = "PENDING_SHIPPING" | "CANCELLED" | "SUCCESS";
export type PaymentStatus = "UNPAID" | "PAID";
export type PaymentType = "COD" | "BANK_TRANSFER";
export type ShippingProviderId = "SPX" | "JNT";

export type AppUser = {
  id: string;
  name: string;
  phoneNumber: string;
  address?: string;
  email?: string;
  level?: "CUSTOMER" | "BTB" | "CTV";
  branchCode?: string;
  isStaff?: boolean;
  status?: string;
  totalOrders?: number;
  totalSpent?: number;
  amountBought?: Array<{
    orderId: string;
    createdAt: string;
  }>;
};

export type ProductDoc = {
  id: string;
  name: string;
  category?: string;
  images?: string[];
  status?: string;
  variants?: Array<{
    stock?: number;
    prices?: {
      btc?: number;
      btb?: number;
      ctv?: number;
    };
    attributes?: Record<string, any>;
  }>;
};

export type PromotionDoc = {
  id: string;
  name: string;
  status: "UPCOMING" | "ONGOING" | "EXPIRED" | "DISABLED";
  discountType: "percent" | "amount";
  scope: "CUSTOMER" | "CART" | "PRODUCT";
  products?: Array<{
    idProduct: string;
    priceBtc: number | null;
    priceBtb: number | null;
    priceCtv: number | null;
    totalAmount: number;
    usedAmount?: number;
    totalSale?: number;
    totalRevenue?: number;
  }>;
  totalSale?: number;
  totalRevenue?: number;
  updatedAt?: string;
};

export type SelectedOrderProduct = {
  id: string;
  name: string;
  image?: string;
  category?: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  promotion?: {
    campaignId: string;
    campaignName: string;
    discountType: "percent" | "amount";
    discountValue: number;
  } | null;
};

export type OrderDoc = {
  id: string;
  idUser: string;
  customerName: string;
  customerPhone: string;
  typeUser: UserLevel;
  addressShowroom: string;
  addressReceive: string;
  products: SelectedOrderProduct[];
  totalProductAmount: number;
  shipFee: number;
  totalAmount: number;
  idDVVC: ShippingProviderId;
  status: OrderStatus;
  statusPayment: PaymentStatus;
  typePayment: PaymentType;
  weight: number;
  length: number;
  width: number;
  height: number;
  cancelReason?: string;
  createdAt: string;
  createdBy: string;

  paymentId: string;
  dateKey: string; // YYYY-MM-DD
  monthKey: string; // YYYY-MM
  hourOfDay: number; // 0-23
  timeBucket: string; // VD: 14:00-14:59
  dayOfWeek: number; // 0-6
};

// export type CreateOrderPayload = {
//   idUser: string;
//   customerName: string;
//   customerPhone: string;
//   typeUser: UserLevel;
//   addressShowroom: string;
//   addressReceive: string;
//   products: SelectedOrderProduct[];
//   totalProductAmount: number;
//   shipFee: number;
//   totalAmount: number;
//   idDVVC: ShippingProviderId;
//   status: OrderStatus;
//   statusPayment: PaymentStatus;
//   typePayment: PaymentType;
//   weight: number;
//   length: number;
//   width: number;
//   height: number;
//   createdAt: string;
//   createdBy: string;
// };

export type PaymentDoc = {
  id: string;
  orderId: string;
  idUser: string;
  customerName: string;
  customerPhone: string;
  amount: number;
  totalProductAmount: number;
  shipFee: number;
  status: PaymentStatus;
  typePayment: PaymentType;
  source: "ORDER";
  createdAt: string;
  paidAt?: string | null;

  dateKey: string; // YYYY-MM-DD
  monthKey: string; // YYYY-MM
  hourOfDay: number; // 0-23
  timeBucket: string; // VD: 14:00-14:59
};

export type ProductSaleLogDoc = {
  id: string;
  orderId: string;
  paymentId: string;
  idProduct: string;
  productName: string;
  idUser: string;
  customerName: string;
  customerPhone: string;

  idCampaign?: string | null;
  campaignName?: string | null;

  typeUser: UserLevel;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  orderTotalAmount: number;
  totalProductAmount: number;
  shipFee: number;

  paymentStatus: PaymentStatus;
  typePayment: PaymentType;
  orderStatus: OrderStatus;

  createdAt: string;
  dateKey: string; // YYYY-MM-DD
  monthKey: string; // YYYY-MM
  hourOfDay: number; // 0-23
  timeBucket: string; // VD: 14:00-14:59
  dayOfWeek: number; // 0-6

  variantId?: string;
  variantIndex?: number;
  variantLabel?: string;
  variantAttributes?: Record<string, any>;
};

export type CreateOrderPayload = Omit<OrderDoc, "id">;
