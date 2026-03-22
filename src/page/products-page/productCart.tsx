import React from "react";
import {
  Button,
  Card,
  Space,
  Tag,
  Typography,
} from "antd";
import { ShoppingCartOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { formatCurrency } from "@/services/common.service";

const { Text } = Typography;

export type ProductDoc = {
  id: string;
  name: string;
  category?: string;
  description?: string;
  images?: string[];
  status?: "AVAILABLE" | "SOLDOUT" | "INACTIVE";
  soldCount?: number;
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

type PromotionDoc = {
  id: string;
  name: string;
  status: "UPCOMING" | "ONGOING" | "EXPIRED" | "DISABLED";
  discountType: "percent" | "amount";
  scope: "CUSTOMER" | "CART" | "PRODUCT";
  startDate?: string;
  expiredDate?: string;
  applyForUserLevels?: string[];
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
};
export const ProductCard = ({
  product,
  saleInfo,
  onClick,
  onAddToCart,
  onBuyNow,
}: {
  product: ProductDoc;
  saleInfo: {
    finalPrice: number;
    basePrice: number;
    hasSale: boolean;
    promotion: {
      campaignId: string;
      campaignName: string;
      discountType: "percent" | "amount";
      discountValue: number;
    } | null;
  };
  onClick: () => void;
  onAddToCart: () => void;
  onBuyNow: () => void;
}) => {
  const image = product?.images?.[0];

  return (
    <Card
      hoverable
      className="h-full overflow-hidden border-weight-s border-color-500"
      styles={{
        body: { padding: 12 },
      }}
      cover={
        <div
          className="aspect-square cursor-pointer overflow-hidden bg-color-50 p-12"
          onClick={onClick}
        >
          <img
            src={image}
            alt={product.name}
            className="h-full w-full object-cover transition duration-300 hover:scale-[1.03]"
          />
        </div>
      }
    >
      <Space direction="vertical" size={8} className="w-full">
        <Text
          className="line-clamp-2 min-h-[40px] cursor-pointer !text-14 !font-medium !leading-20 !text-color-900"
          onClick={onClick}
        >
          {product.name}
        </Text>

        <div>
          {saleInfo.hasSale ? (
            <Space direction="vertical" size={2}>
              <Space size={8} wrap>
                <Text className="!text-18 !font-bold !leading-24 !text-error-500">
                  {formatCurrency(saleInfo.finalPrice)}
                </Text>
                <Text delete className="!text-13 !leading-20 !text-color-600">
                  {formatCurrency(saleInfo.basePrice)}
                </Text>
              </Space>

              {saleInfo.promotion ? (
                <Tag color="red" className="!w-fit">
                  {saleInfo.promotion.discountType === "percent"
                    ? `-${saleInfo.promotion.discountValue}%`
                    : `-${formatCurrency(saleInfo.promotion.discountValue)}`}
                </Tag>
              ) : null}
            </Space>
          ) : (
            <Text className="!text-18 !font-bold !leading-24 !text-color-900">
              {formatCurrency(saleInfo.finalPrice)}
            </Text>
          )}
        </div>

        <Text className="!text-12 !leading-16 !text-color-700">
          Đã bán {Number(product?.soldCount || 0)}
        </Text>

        <Space className="!mt-8 !w-full" size={8}>
          <Button
            icon={<ShoppingCartOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              onAddToCart();
            }}
          >
            Thêm giỏ
          </Button>

          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              onBuyNow();
            }}
          >
            Mua ngay
          </Button>
        </Space>
      </Space>
    </Card>
  );
};