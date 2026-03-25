import { Card } from "antd";
import type { ChatProduct } from "./chat.type";

type Props = {
  product: ChatProduct;
};

const formatPrice = (value?: number | null) => {
  if (typeof value !== "number") return null;

  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(value);
};

export default function ProductMessageCard({ product }: Props) {
  const priceText = formatPrice(product.price);

  return (
    <Card
      size="small"
      styles={{
        body: {
          padding: 12,
        },
      }}
      cover={
        product.image ? (
          <img
            src={product.image}
            alt={product.name}
            style={{
              width: "100%",
              height: 160,
              objectFit: "cover",
            }}
          />
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        <div className="text-14 font-semibold">{product.name}</div>
        {priceText ? <div className="text-13 text-primary-600">{priceText}</div> : null}

        {product.slug ? (
          <a
            href={`/product/${product.slug}`}
            target="_blank"
            rel="noreferrer"
            className="text-13"
          >
            Xem sản phẩm
          </a>
        ) : null}
      </div>
    </Card>
  );
}