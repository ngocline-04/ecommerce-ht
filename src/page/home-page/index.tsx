import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Carousel,
  Col,
  Empty,
  Input,
  Layout,
  List,
  Row,
  Skeleton,
  Space,
  Tag,
  Typography,
} from "antd";
import { FireOutlined, SearchOutlined, RightOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/App";

const { Content, Footer } = Layout;
const { Title, Paragraph, Text } = Typography;

type ProductDoc = {
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
  products?: Array<{
    idProduct: string;
    productName?: string;
    image?: string;
    category?: string;
    priceBtc: number | null;
    priceBtb: number | null;
    priceCtv: number | null;
    totalAmount: number;
    usedAmount?: number;
    totalSale?: number;
    totalRevenue?: number;
  }>;
};

type SearchStatDoc = {
  id?: string;
  productId?: string;
  totalSearch?: number;
  keyword?: string;
};

type BannerDoc = {
  id: string;
  position: "hero_left" | "hero_top_right" | "hero_bottom_right";
  image: string;
  title?: string;
  subtitle?: string;
  link?: string;
  isActive?: boolean;
};

type FlashSaleItem = {
  promotionId: string;
  productId: string;
  productName: string;
  image?: string;
  soldCount: number;
  basePrice: number;
  salePrice: number;
  discountType: "percent" | "amount";
  discountValue: number;
};

const SEARCH_STORAGE_KEY = "home_search_keyword";
const RECENT_SEARCH_STORAGE_KEY = "home_recent_searches";

const DEFAULT_BANNERS = {
  hero_left:
    "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?q=80&w=1400&auto=format&fit=crop",
  hero_top_right:
    "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?q=80&w=900&auto=format&fit=crop",
  hero_bottom_right:
    "https://images.unsplash.com/photo-1484154218962-a197022b5858?q=80&w=900&auto=format&fit=crop",
};

const formatCurrency = (value: number) =>
  Number(value || 0).toLocaleString("vi-VN") + " ₫";

const getRetailPrice = (product: ProductDoc) =>
  Number(product?.variants?.[0]?.prices?.btc || 0);

const SectionHeader = ({
  title,
  subtitle,
  extra,
}: {
  title: string;
  subtitle?: string;
  extra?: React.ReactNode;
}) => (
  <div className="mb-20 flex items-end justify-between gap-16 mobile:flex-col mobile:items-start">
    <div>
      <Title
        level={2}
        className="!mb-8 !text-28 !leading-36 mobile:!text-22 mobile:!leading-28"
      >
        {title}
      </Title>
      {subtitle ? (
        <Paragraph className="!mb-0 !text-14 !leading-20 !text-color-700">
          {subtitle}
        </Paragraph>
      ) : null}
    </div>
    {extra}
  </div>
);

const ProductCard = ({
  product,
  onClick,
}: {
  product: ProductDoc;
  onClick: () => void;
}) => {
  const image = product?.images?.[0] || DEFAULT_BANNERS.hero_top_right;
  const price = getRetailPrice(product);

  return (
    <Card
      hoverable
      onClick={onClick}
      className="overflow-hidden border-weight-s border-color-500"
      styles={{
        body: { padding: 12 },
      }}
      cover={
        <div className="aspect-square overflow-hidden bg-color-50 p-12">
          <img
            src={image}
            alt={product.name}
            className="h-full w-full object-cover transition duration-300 hover:scale-[1.03]"
          />
        </div>
      }
    >
      <Space direction="vertical" size={6} className="w-full">
        <Text className="line-clamp-2 min-h-[40px] !text-14 !font-medium !leading-20 !text-color-900">
          {product.name}
        </Text>

        <Text className="!text-18 !font-bold !leading-24 !text-color-900">
          {formatCurrency(price)}
        </Text>

        <Text className="!text-12 !leading-16 !text-color-700">
          Đã bán {Number(product?.soldCount || 0)}
        </Text>
      </Space>
    </Card>
  );
};

const FlashSaleCard = ({
  item,
  onClick,
}: {
  item: FlashSaleItem;
  onClick: () => void;
}) => {
  const badgeText =
    item.discountType === "percent"
      ? `-${item.discountValue}%`
      : `-${formatCurrency(item.discountValue)}`;

  return (
    <Card
      hoverable
      onClick={onClick}
      className="overflow-hidden"
      styles={{
        body: { padding: 12 },
      }}
      cover={
        <div className="relative aspect-square overflow-hidden bg-color-50 p-12">
          <img
            src={item.image || DEFAULT_BANNERS.hero_left}
            alt={item.productName}
            className="h-full w-full object-cover transition duration-300 hover:scale-[1.03]"
          />
          <Tag
            color="error"
            className="!absolute !right-12 !top-12 !m-0 !px-12 !py-4 !text-12"
          >
            {badgeText}
          </Tag>
        </div>
      }
    >
      <Space direction="vertical" size={6} className="w-full">
        <Text className="line-clamp-2 min-h-[40px] !text-14 !font-medium !leading-20 !text-color-900">
          {item.productName}
        </Text>

        <Space size={8} wrap>
          <Text className="!text-18 !font-bold !leading-24 !text-error-500">
            {formatCurrency(item.salePrice)}
          </Text>
          <Text delete className="!text-13 !leading-20 !text-color-600">
            {formatCurrency(item.basePrice)}
          </Text>
        </Space>

        <Text className="!text-12 !leading-16 !text-color-700">
          Đã bán {item.soldCount}
        </Text>
      </Space>
    </Card>
  );
};

export default function HomePage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState(
    localStorage.getItem(SEARCH_STORAGE_KEY) || "",
  );

  const [products, setProducts] = useState<ProductDoc[]>([]);
  const [promotions, setPromotions] = useState<PromotionDoc[]>([]);
  const [searchStats, setSearchStats] = useState<SearchStatDoc[]>([]);
  const [banners, setBanners] = useState<BannerDoc[]>([]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      const [productSnap, promoSnap, searchSnap, bannerSnap] =
        await Promise.all([
          getDocs(collection(db, "Products")),
          getDocs(collection(db, "Promotions")),
          getDocs(collection(db, "ProductSearchStats")),
          getDocs(collection(db, "HomeBanners")),
        ]);

      setProducts(
        productSnap.docs
          .map((item) => ({ id: item.id, ...item.data() }) as ProductDoc)
          .filter((item) => item.status !== "INACTIVE"),
      );

      setPromotions(
        promoSnap.docs.map(
          (item) => ({ id: item.id, ...item.data() }) as PromotionDoc,
        ),
      );

      setSearchStats(
        searchSnap.docs.map(
          (item) => ({ id: item.id, ...item.data() }) as SearchStatDoc,
        ),
      );

      setBanners(
        bannerSnap.docs
          .map((item) => ({ id: item.id, ...item.data() }) as BannerDoc)
          .filter((item) => item.isActive !== false),
      );
    } catch (error) {
      console.error("Lỗi lấy dữ liệu trang chủ:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const bannerMap = useMemo(() => {
    const map: Record<string, string> = {
      hero_left: DEFAULT_BANNERS.hero_left,
      hero_top_right: DEFAULT_BANNERS.hero_top_right,
      hero_bottom_right: DEFAULT_BANNERS.hero_bottom_right,
    };

    banners.forEach((item) => {
      if (item.position && item.image) {
        map[item.position] = item.image;
      }
    });

    return map;
  }, [banners]);

  const flashSaleProducts = useMemo(() => {
    const ongoingPromotions = promotions.filter(
      (promo) => promo.status === "ONGOING" && promo.scope === "PRODUCT",
    );

    const result: FlashSaleItem[] = [];

    ongoingPromotions.forEach((promo) => {
      (promo.products || []).forEach((promoProduct) => {
        const product = products.find(
          (item) => item.id === promoProduct.idProduct,
        );
        if (!product) return;

        const basePrice = getRetailPrice(product);
        const salePrice = Number(promoProduct.priceBtc || 0);

        if (!basePrice || !salePrice || salePrice >= basePrice) return;

        const discountValue =
          promo.discountType === "percent"
            ? Math.round(((basePrice - salePrice) / basePrice) * 100)
            : basePrice - salePrice;

        result.push({
          promotionId: promo.id,
          productId: product.id,
          productName: promoProduct.productName || product.name,
          image: promoProduct.image || product.images?.[0],
          soldCount:
            Number(promoProduct.totalSale || 0) ||
            Number(product.soldCount || 0),
          basePrice,
          salePrice,
          discountType: promo.discountType,
          discountValue,
        });
      });
    });

    return result.slice(0, 10);
  }, [products, promotions]);

  const topSearchedProducts = useMemo(() => {
    if (searchStats.length) {
      const sorted = [...searchStats].sort(
        (a, b) => Number(b.totalSearch || 0) - Number(a.totalSearch || 0),
      );

      const matched = sorted
        .map((item) =>
          products.find((product) => product.id === item.productId),
        )
        .filter(Boolean) as ProductDoc[];

      const unique = matched.filter(
        (item, index, arr) => arr.findIndex((x) => x.id === item.id) === index,
      );

      if (unique.length) return unique.slice(0, 10);
    }

    return [...products]
      .sort((a, b) => Number(b.soldCount || 0) - Number(a.soldCount || 0))
      .slice(0, 10);
  }, [products, searchStats]);

  const suggestedProducts = useMemo(() => {
    const storedKeyword = String(localStorage.getItem(SEARCH_STORAGE_KEY) || "")
      .trim()
      .toLowerCase();

    if (storedKeyword) {
      const matched = products.filter((item) =>
        String(item.name || "")
          .toLowerCase()
          .includes(storedKeyword),
      );

      if (matched.length) return matched.slice(0, 10);
    }

    const firstCategory = products.find((item) => item.category)?.category;
    if (!firstCategory) return products.slice(0, 5);

    return products
      .filter((item) => item.category === firstCategory)
      .slice(0, 5);
  }, [products]);

  const handleSearch = () => {
    const trimmed = keyword.trim();

    localStorage.setItem(SEARCH_STORAGE_KEY, trimmed);

    const oldSearches = JSON.parse(
      localStorage.getItem(RECENT_SEARCH_STORAGE_KEY) || "[]",
    ) as string[];

    const nextSearches = [
      trimmed,
      ...oldSearches.filter((item) => item !== trimmed),
    ]
      .filter(Boolean)
      .slice(0, 10);

    localStorage.setItem(
      RECENT_SEARCH_STORAGE_KEY,
      JSON.stringify(nextSearches),
    );
    navigate(`/list-product?keyword=${encodeURIComponent(trimmed)}`);
  };

  return (
    <Layout className="!bg-color-50">
      <Content className="!bg-color-50">
        <div className="mx-auto max-w-[1366px] px-24 py-24 mobile:px-16 mobile:py-16">
          {loading ? (
            <Space direction="vertical" size={24} className="w-full">
              <Skeleton.Image
                active
                className="!h-[420px] !w-full !rounded-radius-xxxl mobile:!h-[240px]"
              />
              <Skeleton active paragraph={{ rows: 2 }} />
            </Space>
          ) : (
            <Space direction="vertical" size={56} className="w-full">
              {/* Hero */}
              <Row gutter={[16, 16]}>
                <Col span={16} mobile={24}>
                  <Carousel autoplay dots>
                    {[
                      bannerMap.hero_left,
                      bannerMap.hero_top_right,
                      bannerMap.hero_bottom_right,
                    ].map((image, index) => (
                      <div key={`${image}-${index}`}>
                        <div className="overflow-hidden">
                          <div className="aspect-[16/9] mobile:aspect-[16/10]">
                            <img
                              src={image}
                              alt={`hero-${index}`}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </Carousel>
                </Col>

                <Col span={8} mobile={24}>
                  <Space direction="vertical" size={16} className="w-full">
                    <div className="aspect-[16/9] mobile:aspect-[16/10]">
                      <img
                        src={bannerMap.hero_top_right}
                        alt="hero-top-right"
                        className="h-full w-full object-cover"
                      />
                    </div>

                    <div className="aspect-[16/9] mobile:aspect-[16/10]">
                      <img
                        src={bannerMap.hero_bottom_right}
                        alt="hero-bottom-right"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </Space>
                </Col>
              </Row>

              <Input.Search
                size="large"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Tìm kiếm sản phẩm..."
                onSearch={handleSearch}
                enterButton={
                  <Button
                    type="primary"
                    icon={<SearchOutlined />}
                    className="!h-44"
                  >
                    Tìm kiếm
                  </Button>
                }
              />

              {/* Flash sale */}
              <div>
                <SectionHeader
                  title="Flash Sale"
                  subtitle="Giá ưu đãi theo giá bán lẻ"
                  extra={
                    <Tag icon={<FireOutlined />} color="red">
                      Đang diễn ra
                    </Tag>
                  }
                />

                {flashSaleProducts.length ? (
                  <List
                    grid={{
                      gutter: 16,
                      xs: 2,
                      sm: 2,
                      md: 3,
                      lg: 4,
                      xl: 5,
                      xxl: 5,
                    }}
                    dataSource={flashSaleProducts}
                    renderItem={(item) => (
                      <List.Item>
                        <FlashSaleCard
                          item={item}
                          onClick={() => navigate(`/product/${item.productId}`)}
                        />
                      </List.Item>
                    )}
                  />
                ) : (
                  <Empty description="Chưa có sản phẩm Flash Sale" />
                )}
              </div>

              {/* Top search */}
              <div>
                <SectionHeader
                  title="Tìm kiếm hàng đầu"
                  subtitle="Ưu tiên theo xu hướng tìm kiếm và lượt bán"
                />

                {topSearchedProducts.length ? (
                  <List
                    grid={{
                      gutter: 16,
                      xs: 2,
                      sm: 2,
                      md: 3,
                      lg: 4,
                      xl: 5,
                      xxl: 5,
                    }}
                    dataSource={topSearchedProducts}
                    renderItem={(item) => (
                      <List.Item>
                        <ProductCard
                          product={item}
                          onClick={() => navigate(`/product/${item.id}`)}
                        />
                      </List.Item>
                    )}
                  />
                ) : (
                  <Empty description="Chưa có dữ liệu tìm kiếm" />
                )}
              </div>

              {/* Suggestion */}
              <div>
                <SectionHeader
                  title="Gợi ý sản phẩm dành cho bạn"
                  subtitle="Dựa trên từ khóa bạn đã tìm gần đây"
                />

                {suggestedProducts.length ? (
                  <List
                    grid={{
                      gutter: 16,
                      xs: 2,
                      sm: 2,
                      md: 3,
                      lg: 4,
                      xl: 5,
                      xxl: 5,
                    }}
                    dataSource={suggestedProducts}
                    renderItem={(item) => (
                      <List.Item>
                        <ProductCard
                          product={item}
                          onClick={() => navigate(`/product/${item.id}`)}
                        />
                      </List.Item>
                    )}
                  />
                ) : (
                  <Empty description="Chưa có sản phẩm gợi ý" />
                )}
              </div>
            </Space>
          )}
        </div>
      </Content>
    </Layout>
  );
}
