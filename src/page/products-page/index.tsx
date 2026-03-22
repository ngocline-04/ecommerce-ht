import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, Col, Empty, Input, Pagination, Row, Select, Slider } from "antd";
import { useLocation, useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "@/App";
import { toast } from "react-toastify";
import dayjs from "dayjs";
import { addToCartPending } from "@/services/cart.service";
import { ProductCard, ProductDoc } from "./productCart";
import { formatCurrency } from "@/services/common.service";

type CategoryDoc = {
  id: string;
  name: string;
  data?: string;
  categories?: Array<{
    id?: string;
    name?: string;
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

type AppUser = {
  id: string;
  email?: string;
  level?: "CUSTOMER" | "BTB" | "CTV";
  name?: string;
};

const normalizeUserLevel = (level?: string): "BTC" | "BTB" | "CTV" => {
  if (level === "BTB") return "BTB";
  if (level === "CTV") return "CTV";
  return "BTC";
};

const getBasePrice = (product: ProductDoc) =>
  Number(product?.variants?.[0]?.prices?.btc || 0);

const isPromotionValid = (
  promo: PromotionDoc,
  productId: string,
  typeUser: "BTC" | "BTB" | "CTV",
) => {
  if (promo.status !== "ONGOING") return false;
  if (promo.scope !== "PRODUCT") return false;

  const now = dayjs();
  if (promo.startDate && now.isBefore(dayjs(promo.startDate))) return false;
  if (promo.expiredDate && now.isAfter(dayjs(promo.expiredDate))) return false;

  if (
    promo.applyForUserLevels?.length &&
    !promo.applyForUserLevels.includes(typeUser)
  ) {
    return false;
  }

  const productPromo = promo.products?.find(
    (item) => item.idProduct === productId,
  );
  if (!productPromo) return false;

  const usedAmount = Number(productPromo.usedAmount || 0);
  const totalAmount = Number(productPromo.totalAmount || 0);
  if (totalAmount > 0 && usedAmount >= totalAmount) return false;

  return true;
};

const getSaleInfo = (
  product: ProductDoc,
  promotions: PromotionDoc[],
  typeUser: "BTC" | "BTB" | "CTV",
) => {
  const basePrice = getBasePrice(product);

  const campaign = promotions.find((promo) =>
    isPromotionValid(promo, product.id, typeUser),
  );

  if (!campaign) {
    return {
      finalPrice: basePrice,
      basePrice,
      promotion: null,
      hasSale: false,
    };
  }

  const promoProduct = campaign.products?.find(
    (item) => item.idProduct === product.id,
  );
  if (!promoProduct) {
    return {
      finalPrice: basePrice,
      basePrice,
      promotion: null,
      hasSale: false,
    };
  }

  const salePrice =
    typeUser === "BTB"
      ? Number(promoProduct.priceBtb || 0)
      : typeUser === "CTV"
        ? Number(promoProduct.priceCtv || 0)
        : Number(promoProduct.priceBtc || 0);

  if (!salePrice || salePrice >= basePrice) {
    return {
      finalPrice: basePrice,
      basePrice,
      promotion: null,
      hasSale: false,
    };
  }

  const discountValue =
    campaign.discountType === "percent"
      ? Math.round(((basePrice - salePrice) / basePrice) * 100)
      : basePrice - salePrice;

  return {
    finalPrice: salePrice,
    basePrice,
    hasSale: true,
    promotion: {
      campaignId: campaign.id,
      campaignName: campaign.name,
      discountType: campaign.discountType,
      discountValue,
    },
  };
};

export default function ListProductPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [products, setProducts] = useState<ProductDoc[]>([]);
  const [promotions, setPromotions] = useState<PromotionDoc[]>([]);
  const [currentUserProfile, setCurrentUserProfile] = useState<AppUser | null>(
    null,
  );

  const [keyword, setKeyword] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<
    string | undefined
  >();
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 50000000]);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;
  const [categories, setCategories] = useState<CategoryDoc[]>([]);

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams(location.search);
    const keywordQuery = params.get("keyword") || "";
    const categoryQuery = params.get("category") || "";

    setKeyword(keywordQuery);
    setSelectedCategory(categoryQuery || undefined);

    const [productSnap, promotionSnap, categorySnap, userSnap] =
      await Promise.all([
        getDocs(collection(db, "Products")),
        getDocs(collection(db, "Promotions")),
        getDocs(collection(db, "Category")),
        auth.currentUser?.email
          ? getDocs(collection(db, "Users"))
          : Promise.resolve(null as any),
      ]);

    const productData = productSnap.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    })) as ProductDoc[];

    const promotionData = promotionSnap.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    })) as PromotionDoc[];

    const categoryData = categorySnap.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    })) as CategoryDoc[];

    setCategories(categoryData);

    setProducts(productData.filter((item) => item.status === "AVAILABLE"));
    setPromotions(promotionData);

    if (userSnap) {
      const matchedUser = userSnap.docs
        .map((item) => ({ id: item.id, ...item.data() }) as AppUser)
        .find((item) => item.email === auth.currentUser?.email);

      setCurrentUserProfile(matchedUser || null);
    } else {
      setCurrentUserProfile(null);
    }
  }, [location.search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const typeUser = normalizeUserLevel(currentUserProfile?.level);

  const categoryOptions = useMemo(() => {
    const result: Array<{ value: string; label: string }> = [];

    categories.forEach((item) => {
      if (Array.isArray(item.categories) && item.categories.length > 0) {
        item.categories.forEach((child) => {
          if (child?.id && child?.name) {
            result.push({
              value: child.id,
              label: child.name,
            });
          }
        });
        return;
      }

      if (item.data && item.name) {
        result.push({
          value: item.data,
          label: item.name,
        });
        return;
      }

      if (item.id && item.name) {
        result.push({
          value: item.id,
          label: item.name,
        });
      }
    });

    return result;
  }, [categories]);

  const isProductMatchedCategory = (
    product: ProductDoc,
    selectedCategory?: string,
  ) => {
    if (!selectedCategory) return true;

    const productCategory = String(product.category || "").trim();
    if (!productCategory) return false;

    return (
      productCategory === selectedCategory ||
      productCategory.toLowerCase() === selectedCategory.toLowerCase()
    );
  };

  const filteredProducts = useMemo(() => {
    return products.filter((item) => {
      const saleInfo = getSaleInfo(item, promotions, typeUser);

      const matchedKeyword = keyword.trim()
        ? item.name?.toLowerCase().includes(keyword.trim().toLowerCase())
        : true;

      const matchedCategory = isProductMatchedCategory(item, selectedCategory);

      const matchedPrice =
        saleInfo.finalPrice >= priceRange[0] &&
        saleInfo.finalPrice <= priceRange[1];

      return matchedKeyword && matchedCategory && matchedPrice;
    });
  }, [products, promotions, typeUser, keyword, selectedCategory, priceRange]);

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [keyword, selectedCategory, priceRange]);

  const requireLoginThen = (action: () => Promise<void> | void) => {
    if (!auth.currentUser) {
      sessionStorage.setItem(
        "post_login_redirect",
        JSON.stringify({
          redirect: location.pathname + location.search,
        }),
      );
      navigate("/login");
      return;
    }

    action();
  };

  const handleAddToCart = async (product: ProductDoc, buyNow?: boolean) => {
    requireLoginThen(async () => {
      const saleInfo = getSaleInfo(product, promotions, typeUser);
      const userId = currentUserProfile?.id;

      if (!userId) {
        toast.error("Không tìm thấy thông tin người dùng");
        return;
      }

      await addToCartPending({
        idUser: userId,
        productId: product.id,
        productName: product.name || "",
        productImage: product.images?.[0] || "",
        category: product.category || "",
        quantity: 1,
        unitPrice: saleInfo.finalPrice,
        lineTotal: saleInfo.finalPrice,
        typeUser,
        promotion: saleInfo.promotion,
        checked: true,
      });

      toast.success(
        buyNow
          ? "Đã thêm sản phẩm và chuyển sang giỏ hàng"
          : "Đã thêm vào giỏ hàng",
      );

      if (buyNow) {
        navigate("/cart");
      }
    });
  };

  return (
    <div className="block-content">
      <Card bordered={false}>
        <Row gutter={[16, 16]} align="middle">
          <Col span={8} mobile={24}>
            <Input.Search
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onSearch={(value) => {
                const params = new URLSearchParams(location.search);
                if (value) {
                  params.set("keyword", value);
                } else {
                  params.delete("keyword");
                }

                navigate(`/list-product?${params.toString()}`);
              }}
              placeholder="Tìm kiếm theo tên sản phẩm"
              size="large"
            />
          </Col>

          <Col span={6} mobile={24}>
            <Select
              size="large"
              allowClear
              className="w-full"
              placeholder="Lọc theo danh mục"
              options={categoryOptions}
              value={selectedCategory}
              onChange={(value) => {
                const params = new URLSearchParams(location.search);

                if (value) {
                  params.set("category", value);
                } else {
                  params.delete("category");
                }

                navigate(`/list-product?${params.toString()}`);
              }}
            />
          </Col>

          <Col span={10} mobile={24}>
            <div className="px-12">
              <div className="mb-8 text-14 text-color-700">
                Mức giá: {formatCurrency(priceRange[0])} -{" "}
                {formatCurrency(priceRange[1])}
              </div>
              <Slider
                range
                min={0}
                max={50000000}
                step={500000}
                value={priceRange}
                onChange={(value) => setPriceRange(value as [number, number])}
              />
            </div>
          </Col>
        </Row>
      </Card>

      <div className="mt-24">
        {paginatedProducts.length ? (
          <>
            <Row gutter={[16, 24]}>
              {paginatedProducts.map((product) => {
                const saleInfo = getSaleInfo(product, promotions, typeUser);

                return (
                  <Col key={product.id} xs={24} sm={12} md={8} lg={6} xl={6}>
                    <ProductCard
                      product={product}
                      saleInfo={saleInfo}
                      onClick={() => navigate(`/product/${product.id}`)}
                      onAddToCart={() => handleAddToCart(product, false)}
                      onBuyNow={() => handleAddToCart(product, true)}
                    />
                  </Col>
                );
              })}
            </Row>

            <div className="mt-24 flex justify-end">
              <Pagination
                current={currentPage}
                pageSize={pageSize}
                total={filteredProducts.length}
                showSizeChanger={false}
                onChange={(page) => setCurrentPage(page)}
              />
            </div>
          </>
        ) : (
          <Card bordered={false}>
            <Empty description="Không có sản phẩm phù hợp" />
          </Card>
        )}
      </div>
    </div>
  );
}
