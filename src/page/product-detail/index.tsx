import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Button,
  Card,
  Carousel,
  Col,
  Descriptions,
  Divider,
  Empty,
  Form,
  Image,
  Input,
  InputNumber,
  List,
  Rate,
  Row,
  Space,
  Spin,
  Tag,
  Upload,
} from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import {
  MinusOutlined,
  PlusOutlined,
  ShoppingCartOutlined,
  ThunderboltOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import { addDoc, collection, getDocs, query, where } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import dayjs from "dayjs";
import { toast } from "react-toastify";

import { auth, db, storage } from "@/App";
import { addToCartPending } from "@/services/cart.service";
import {
  formatCurrency,
  getProductPromotion,
  getVariantId,
  getVariantLabel,
} from "@/services/order.service";
import type {
  AppUser,
  ProductDoc,
  PromotionDoc,
  UserLevel,
} from "@/services/order.types";
import { STATUS_CONVERT } from "@/constant";

type ProductReviewDoc = {
  id: string;
  productId: string;
  productName: string;
  idUser: string;
  userName: string;
  userEmail?: string;
  rating: number;
  content: string;
  imageUrls: string[];
  status: "VISIBLE" | "HIDDEN";
  createdAt: string;
  updatedAt: string;
};

type CategoryChild =
  | string
  | {
      id?: string;
      name?: string;
      data?: string;
    };

type CategoryDoc = {
  id: string;
  name?: string;
  data?: string;
  categories?: CategoryChild[];
};

const normalizeUserLevel = (level?: string): UserLevel => {
  if (level === "BTB") return "BTB";
  if (level === "CTV") return "CTV";
  return "BTC";
};

const normalizeCategoryCode = (value?: string) => {
  return String(value || "").replace(/"/g, "").trim();
};

const getCategoryInfo = (
  categoryCode?: string,
  categories: CategoryDoc[] = [],
) => {
  const safeCode = normalizeCategoryCode(categoryCode);

  if (!safeCode) {
    return {
      parentCode: "",
      parentName: "",
      childCode: "",
      childName: "",
      displayName: "",
    };
  }

  for (const item of categories) {
    const parentCode = normalizeCategoryCode(item.data || item.id);
    const parentName = String(item.name || "").trim();

    if (parentCode === safeCode) {
      return {
        parentCode,
        parentName,
        childCode: safeCode,
        childName: parentName,
        displayName: parentName || safeCode,
      };
    }

    if (Array.isArray(item.categories)) {
      for (const child of item.categories) {
        if (typeof child === "string") {
          const childCode = normalizeCategoryCode(child);
          if (childCode === safeCode) {
            return {
              parentCode,
              parentName,
              childCode,
              childName: childCode,
              displayName: parentName || childCode,
            };
          }
        } else {
          const childCode = normalizeCategoryCode(child?.id || child?.data);
          const childName = String(child?.name || "").trim();

          if (childCode === safeCode) {
            return {
              parentCode,
              parentName,
              childCode,
              childName,
              displayName: childName || parentName || childCode,
            };
          }
        }
      }
    }
  }

  return {
    parentCode: safeCode,
    parentName: safeCode,
    childCode: safeCode,
    childName: safeCode,
    displayName: safeCode,
  };
};

const getAllProductImages = (product?: ProductDoc | null) => {
  if (!product) return [];

  const fromImages = Array.isArray(product.images) ? product.images : [];

  const fromVariants = Array.isArray(product.variants)
    ? product.variants.flatMap((variant: any) => {
        if (Array.isArray(variant?.images)) return variant.images;
        if (variant?.image) return [variant.image];
        return [];
      })
    : [];

  return [...new Set([...fromImages, ...fromVariants].filter(Boolean))];
};

const getVariantAttributeMap = (product?: ProductDoc | null) => {
  const result: Record<string, string[]> = {};

  if (!Array.isArray(product?.variants)) return result;

  product.variants.forEach((variant: any) => {
    const attrs = variant?.attributes || {};
    Object.entries(attrs).forEach(([key, value]) => {
      const safeValue = String(value || "").trim();
      if (!safeValue) return;

      if (!result[key]) result[key] = [];
      if (!result[key].includes(safeValue)) {
        result[key].push(safeValue);
      }
    });
  });

  return result;
};

const getMatchedVariantIndex = (
  product: ProductDoc | null,
  selectedAttributes: Record<string, string>,
) => {
  if (!product?.variants?.length) return 0;

  const attributeMap = getVariantAttributeMap(product);
  const attributeKeys = Object.keys(attributeMap);
  if (!attributeKeys.length) return 0;

  const selectedEnough = attributeKeys.every((key) =>
    String(selectedAttributes[key] || "").trim(),
  );

  if (!selectedEnough) return -1;

  return product.variants.findIndex((variant: any) => {
    const attrs = variant?.attributes || {};
    return attributeKeys.every(
      (key) =>
        String(attrs[key] || "").trim() ===
        String(selectedAttributes[key] || "").trim(),
    );
  });
};

const getVariantPrices = (product: ProductDoc, variantIndex = 0) => {
  const variant =
    product?.variants?.[variantIndex] || product?.variants?.[0] || null;
  const prices = variant?.prices || {};

  return {
    btc: Number(prices.btc || 0),
    btb: Number(prices.btb || 0),
    ctv: Number(prices.ctv || 0),
  };
};

const getVisiblePriceRows = (
  product: ProductDoc,
  userLevel: UserLevel,
  variantIndex = 0,
) => {
  const prices = getVariantPrices(product, variantIndex);

  if (userLevel === "BTB") {
    return [
      {
        key: "btc",
        label: "Giá khách lẻ",
        value: prices.btc,
      },
      {
        key: "btb",
        label: "Giá BTB",
        value: prices.btb,
      },
    ].filter((item) => item.value > 0);
  }

  if (userLevel === "CTV") {
    return [
      {
        key: "btc",
        label: "Giá khách lẻ",
        value: prices.btc,
      },
      {
        key: "ctv",
        label: "Giá CTV",
        value: prices.ctv,
      },
    ].filter((item) => item.value > 0);
  }

  return [
    {
      key: "btc",
      label: "Giá khách lẻ",
      value: prices.btc,
    },
  ].filter((item) => item.value > 0);
};

const getBuyPriceByUserLevel = (
  product: ProductDoc,
  userLevel: UserLevel,
  variantIndex = 0,
) => {
  const prices = getVariantPrices(product, variantIndex);

  if (userLevel === "BTB") return prices.btb || prices.btc || 0;
  if (userLevel === "CTV") return prices.ctv || prices.btc || 0;
  return prices.btc || 0;
};

const buildSaleInfo = (
  product: ProductDoc,
  promotions: PromotionDoc[],
  typeUser: UserLevel,
  quantity: number,
  variantIndex: number,
) => {
  const basePrice = getBuyPriceByUserLevel(product, typeUser, variantIndex);
  const campaign = getProductPromotion(
    promotions,
    product.id,
    typeUser,
    quantity,
  );

  if (!campaign) {
    return {
      finalPrice: basePrice,
      basePrice,
      hasSale: false,
      promotion: null,
    };
  }

  const promoProduct = campaign.products?.find(
    (item: any) => item?.idProduct === product.id,
  );

  if (!promoProduct) {
    return {
      finalPrice: basePrice,
      basePrice,
      hasSale: false,
      promotion: null,
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
      hasSale: false,
      promotion: null,
    };
  }

  const discountValue =
    campaign.discountType === "percent"
      ? Math.round(((basePrice - salePrice) / basePrice) * 100)
      : Math.max(0, basePrice - salePrice);

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

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [reviewForm] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const [product, setProduct] = useState<ProductDoc | null>(null);
  const [promotions, setPromotions] = useState<PromotionDoc[]>([]);
  const [categories, setCategories] = useState<CategoryDoc[]>([]);
  const [currentUserProfile, setCurrentUserProfile] = useState<AppUser | null>(
    null,
  );
  const [reviews, setReviews] = useState<ProductReviewDoc[]>([]);

  const [selectedAttributes, setSelectedAttributes] = useState<
    Record<string, string>
  >({});
  const [quantity, setQuantity] = useState(1);

  const [reviewFiles, setReviewFiles] = useState<File[]>([]);
  const [reviewFileList, setReviewFileList] = useState<UploadFile[]>([]);

  const fetchProductReviews = useCallback(async (productId: string) => {
    const reviewQuery = query(
      collection(db, "ProductReviews"),
      where("productId", "==", productId),
      where("status", "==", "VISIBLE"),
    );

    const reviewSnap = await getDocs(reviewQuery);

    const reviewData = reviewSnap.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    })) as ProductReviewDoc[];

    return reviewData.sort(
      (a, b) =>
        dayjs(b.createdAt || 0).valueOf() - dayjs(a.createdAt || 0).valueOf(),
    );
  }, []);

  const fetchData = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);

      const [productSnap, promotionSnap, categorySnap, userSnap] =
        await Promise.all([
          getDocs(
            query(collection(db, "Products"), where("status", "==", "AVAILABLE")),
          ),
          getDocs(collection(db, "Promotions")),
          getDocs(collection(db, "Category")),
          auth.currentUser?.email
            ? getDocs(
                query(
                  collection(db, "Users"),
                  where("email", "==", auth.currentUser.email),
                  where("isStaff", "==", false),
                ),
              )
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

      const matchedProduct =
        productData.find((item) => String(item.id) === String(id)) || null;

      setProduct(matchedProduct);
      setPromotions(promotionData);
      setCategories(categoryData);

      if (userSnap?.docs?.length) {
        const userDoc = userSnap.docs[0];
        setCurrentUserProfile({
          id: userDoc.id,
          ...userDoc.data(),
        } as AppUser);
      } else {
        setCurrentUserProfile(null);
      }

      if (matchedProduct?.id) {
        const reviewData = await fetchProductReviews(matchedProduct.id);
        setReviews(reviewData);
      } else {
        setReviews([]);
      }
    } catch (error) {
      console.error(error);
      toast.error("Không tải được chi tiết sản phẩm");
    } finally {
      setLoading(false);
    }
  }, [fetchProductReviews, id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const typeUser = useMemo(
    () => normalizeUserLevel(currentUserProfile?.level),
    [currentUserProfile?.level],
  );

  const categoryInfo = useMemo(
    () => getCategoryInfo(product?.category, categories),
    [product?.category, categories],
  );

  const allImages = useMemo(() => getAllProductImages(product), [product]);

  const variantAttributeMap = useMemo(
    () => getVariantAttributeMap(product),
    [product],
  );

  const variantAttributeKeys = useMemo(
    () => Object.keys(variantAttributeMap),
    [variantAttributeMap],
  );

  const matchedVariantIndex = useMemo(
    () => getMatchedVariantIndex(product, selectedAttributes),
    [product, selectedAttributes],
  );

  const selectedVariant = useMemo(() => {
    if (!product?.variants?.length) return null;
    if (matchedVariantIndex < 0) return null;
    return product.variants[matchedVariantIndex] || null;
  }, [matchedVariantIndex, product]);

  const requireVariantSelection = variantAttributeKeys.length > 0;
  const canOperate = !requireVariantSelection || matchedVariantIndex >= 0;

  const effectiveVariantIndex = matchedVariantIndex >= 0 ? matchedVariantIndex : 0;

  const visiblePriceRows = useMemo(() => {
    if (!product) return [];
    return getVisiblePriceRows(product, typeUser, effectiveVariantIndex);
  }, [effectiveVariantIndex, product, typeUser]);

  const saleInfo = useMemo(() => {
    if (!product) {
      return {
        finalPrice: 0,
        basePrice: 0,
        hasSale: false,
        promotion: null,
      };
    }

    return buildSaleInfo(
      product,
      promotions,
      typeUser,
      quantity,
      effectiveVariantIndex,
    );
  }, [effectiveVariantIndex, product, promotions, quantity, typeUser]);

  const averageRating = useMemo(() => {
    if (!reviews.length) return 0;
    const total = reviews.reduce((sum, item) => sum + Number(item.rating || 0), 0);
    return total / reviews.length;
  }, [reviews]);

  const requireLoginThen = (action: () => Promise<void> | void) => {
    if (!auth.currentUser) {
      sessionStorage.setItem(
        "post_login_redirect",
        JSON.stringify({
          redirect: `/product/${id}`,
        }),
      );
      navigate("/login");
      return;
    }

    action();
  };

  const validateVariantBeforeAction = () => {
    if (!product) return false;

    if (requireVariantSelection && matchedVariantIndex < 0) {
      toast.warning("Vui lòng chọn đầy đủ thuộc tính sản phẩm");
      return false;
    }

    return true;
  };

  const handleSelectAttribute = (attributeName: string, value: string) => {
    setSelectedAttributes((prev) => ({
      ...prev,
      [attributeName]: value,
    }));
    setQuantity(1);
  };

  const handleChangeQuantity = (nextValue: number) => {
    if (!validateVariantBeforeAction()) return;

    const stock = Number((selectedVariant as any)?.stock || 0);
    const safeValue = Math.max(1, Number(nextValue || 1));

    if (stock > 0 && safeValue > stock) {
      toast.warning(`Số lượng tối đa là ${stock}`);
      setQuantity(stock);
      return;
    }

    setQuantity(safeValue);
  };

  const handleAddToCart = async (buyNow?: boolean) => {
    requireLoginThen(async () => {
      if (!product) return;
      if (!validateVariantBeforeAction()) return;

      const userId = currentUserProfile?.id;
      if (!userId) {
        toast.error("Không tìm thấy thông tin người dùng");
        return;
      }

      const variantIndex = effectiveVariantIndex;
      const variant = product.variants?.[variantIndex] || null;
      const stock = Number((variant as any)?.stock || 0);

      if (stock > 0 && quantity > stock) {
        toast.warning(`Số lượng vượt tồn kho. Tối đa: ${stock}`);
        return;
      }

      await addToCartPending({
        idUser: userId,
        productId: product.id,
        productName: product.name || "",
        productImage: allImages?.[0] || product.images?.[0] || "",
        category: categoryInfo.parentCode || product.category || "",
        variantId: getVariantId(product.id, variantIndex),
        variantIndex,
        variantLabel: getVariantLabel(variant as any),
        variantAttributes: (variant as any)?.attributes || {},
        quantity,
        unitPrice: saleInfo.finalPrice,
        lineTotal: saleInfo.finalPrice * quantity,
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

  const handleBeforeUpload = (file: File) => {
    setReviewFiles((prev) => [...prev, file]);
    setReviewFileList((prev) => [
      ...prev,
      {
        uid: `${file.name}_${file.lastModified}_${Math.random()}`,
        name: file.name,
        status: "done",
        originFileObj: file,
      },
    ]);
    return false;
  };

  const handleRemoveReviewFile = (file: UploadFile) => {
    setReviewFileList((prev) => prev.filter((item) => item.uid !== file.uid));
    setReviewFiles((prev) =>
      prev.filter((item) => {
        const currentKey = `${item.name}_${item.lastModified}`;
        const removedKey = `${file.name}_${(file as any)?.originFileObj?.lastModified || ""}`;
        return currentKey !== removedKey;
      }),
    );
  };

  const uploadReviewImages = async (
    productId: string,
    userId: string,
    files: File[],
  ) => {
    const imageUrls = await Promise.all(
      files.map(async (file) => {
        const extension = file.name.split(".").pop() || "jpg";
        const fileName = `${Date.now()}_${Math.random()
          .toString(36)
          .slice(2)}.${extension}`;

        const storageRef = ref(
          storage,
          `product-reviews/${productId}/${userId}/${fileName}`,
        );

        await uploadBytes(storageRef, file);
        return getDownloadURL(storageRef);
      }),
    );

    return imageUrls;
  };

  const handleSubmitReview = async (values: any) => {
    requireLoginThen(async () => {
      if (!product) return;

      if (!currentUserProfile?.id) {
        toast.error("Không tìm thấy thông tin người dùng");
        return;
      }

      try {
        setReviewSubmitting(true);

        const imageUrls = await uploadReviewImages(
          product.id,
          currentUserProfile.id,
          reviewFiles,
        );

        const now = dayjs().toISOString();

        const payload = {
          productId: product.id,
          productName: product.name || "",
          idUser: currentUserProfile.id,
          userName:
            currentUserProfile.name ||
            auth.currentUser?.displayName ||
            auth.currentUser?.email ||
            "Khách hàng",
          userEmail: auth.currentUser?.email || "",
          rating: Number(values.rating || 5),
          content: String(values.content || "").trim(),
          imageUrls,
          status: "VISIBLE" as const,
          createdAt: now,
          updatedAt: now,
        };

        const reviewRef = await addDoc(collection(db, "ProductReviews"), payload);

        setReviews((prev) => [
          {
            id: reviewRef.id,
            ...payload,
          },
          ...prev,
        ]);

        reviewForm.resetFields();
        reviewForm.setFieldsValue({ rating: 5 });
        setReviewFiles([]);
        setReviewFileList([]);

        toast.success("Gửi đánh giá thành công");
      } catch (error) {
        console.error(error);
        toast.error("Gửi đánh giá thất bại");
      } finally {
        setReviewSubmitting(false);
      }
    });
  };

  if (loading) {
    return (
      <div className="block-content">
        <Card bordered={false} className="rounded-radius-xl">
          <div className="flex min-h-[320px] items-center justify-center">
            <Spin size="large" />
          </div>
        </Card>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="block-content">
        <Card bordered={false} className="rounded-radius-xl">
          <Empty description="Không tìm thấy sản phẩm" />
        </Card>
      </div>
    );
  }

  return (
    <div className="block-content">
      <Row gutter={[24, 24]}>
        <Col span={14} mobile={24}>
          <Card bordered={false} className="rounded-radius-xl shadow-down-s">
            {allImages.length ? (
              <>
                <Carousel autoplay dots className="overflow-hidden rounded-radius-l">
                  {allImages.map((image, index) => (
                    <div key={`${image}_${index}`}>
                      <div className="flex h-[520px] items-center justify-center bg-color-100 mobile:h-[320px]">
                        <Image
                          src={image}
                          alt={`${product.name}_${index}`}
                          preview
                          className="max-h-full object-contain"
                        />
                      </div>
                    </div>
                  ))}
                </Carousel>

                <div className="mt-16 grid grid-cols-4 gap-12 mobile:grid-cols-2">
                  {allImages.map((image, index) => (
                    <div
                      key={`${image}_thumb_${index}`}
                      className="overflow-hidden rounded-radius-m border border-color-300 bg-color-100"
                    >
                      <Image
                        src={image}
                        alt={`${product.name}_thumb_${index}`}
                        preview
                        className="h-[110px] w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex h-[520px] items-center justify-center bg-color-100 text-color-700 mobile:h-[320px]">
                Không có ảnh sản phẩm
              </div>
            )}
          </Card>
        </Col>

        <Col span={10} mobile={24}>
          <Card bordered={false} className="rounded-radius-xl shadow-down-s">
            <div className="mb-8 text-24 font-semibold leading-32 text-color-900">
              {product.name}
            </div>

            <div className="mb-12 flex flex-wrap gap-8">
              {categoryInfo.parentName ? (
                <Tag color="blue">{categoryInfo.parentName}</Tag>
              ) : null}

              {categoryInfo.childName &&
              categoryInfo.childName !== categoryInfo.parentName ? (
                <Tag color="cyan">{categoryInfo.childName}</Tag>
              ) : null}

              {product.status ? (
                <Tag color={product.status === "AVAILABLE" ? "green" : "default"}>
                  {STATUS_CONVERT[product.status]}
                </Tag>
              ) : null}

              {saleInfo.promotion?.campaignName ? (
                <Tag color="red">{saleInfo.promotion.campaignName}</Tag>
              ) : null}
            </div>

            <div className="mb-16 flex items-center gap-12">
              <Rate disabled allowHalf value={averageRating} />
              <span className="text-14 text-color-700">
                {reviews.length} đánh giá
              </span>
            </div>

            <div className="mb-20 rounded-radius-l bg-color-100 p-16">
              <div className="mb-12 text-15 font-medium text-color-900">
                Bảng giá theo tài khoản
              </div>

              <div className="flex flex-col gap-8">
                {visiblePriceRows.map((row) => (
                  <div
                    key={row.key}
                    className="flex items-center justify-between rounded-radius-m border border-color-300 bg-color-50 px-12 py-8"
                  >
                    <span className="text-14 text-color-700">{row.label}</span>
                    <span className="text-16 font-semibold text-color-900">
                      {formatCurrency(row.value)}
                    </span>
                  </div>
                ))}
              </div>

              <Divider className="my-12" />

              <div className="flex items-end gap-12">
                <div className="text-28 font-semibold leading-36 text-primary-500">
                  {formatCurrency(saleInfo.finalPrice)}
                </div>

                {saleInfo.hasSale ? (
                  <div className="pb-4 text-16 leading-24 text-color-700 line-through">
                    {formatCurrency(saleInfo.basePrice)}
                  </div>
                ) : null}
              </div>

              <div className="mt-8 text-14 text-color-700">
                Giá áp dụng khi mua với tài khoản hiện tại
              </div>

              {saleInfo.hasSale && saleInfo.promotion ? (
                <div className="mt-8 text-14 text-error-600">
                  Giảm{" "}
                  {saleInfo.promotion.discountType === "percent"
                    ? `${saleInfo.promotion.discountValue}%`
                    : formatCurrency(saleInfo.promotion.discountValue)}
                </div>
              ) : null}
            </div>

            {variantAttributeKeys.map((attributeKey) => (
              <div key={attributeKey} className="mb-20">
                <div className="mb-8 text-15 font-medium text-color-900">
                  Chọn {attributeKey}
                </div>

                <div className="flex flex-wrap gap-8">
                  {variantAttributeMap[attributeKey]?.map((value) => {
                    const active = selectedAttributes[attributeKey] === value;

                    return (
                      <Button
                        key={`${attributeKey}_${value}`}
                        type={active ? "primary" : "default"}
                        onClick={() => handleSelectAttribute(attributeKey, value)}
                        className="rounded-radius-m"
                      >
                        {value}
                      </Button>
                    );
                  })}
                </div>
              </div>
            ))}

            {requireVariantSelection && !selectedVariant ? (
              <div className="mb-20 rounded-radius-l border border-error-200 bg-error-50 p-16 text-14 text-error-600">
                Vui lòng chọn đầy đủ thuộc tính để thao tác số lượng và mua hàng
              </div>
            ) : null}

            {selectedVariant ? (
              <div className="mb-20 rounded-radius-l border border-color-300 p-16">
                <div className="mb-8 text-14 text-color-700">Biến thể đã chọn</div>
                <div className="mb-8 text-15 font-medium text-color-900">
                  {getVariantLabel(selectedVariant as any)}
                </div>
                <div className="text-14 text-color-700">
                  Tồn kho: {Number((selectedVariant as any)?.stock || 0)}
                </div>
              </div>
            ) : null}

            <div className="mb-20">
              <div className="mb-8 text-15 font-medium text-color-900">Số lượng</div>

              <Space.Compact>
                <Button
                  icon={<MinusOutlined />}
                  disabled={!canOperate}
                  onClick={() => handleChangeQuantity(quantity - 1)}
                />
                <InputNumber
                  min={1}
                  disabled={!canOperate}
                  value={quantity}
                  onChange={(value) => handleChangeQuantity(Number(value || 1))}
                  style={{ width: 100 }}
                />
                <Button
                  icon={<PlusOutlined />}
                  disabled={!canOperate}
                  onClick={() => handleChangeQuantity(quantity + 1)}
                />
              </Space.Compact>
            </div>

            <div className="flex flex-wrap gap-12">
              <Button
                size="large"
                icon={<ShoppingCartOutlined />}
                disabled={!canOperate}
                onClick={() => handleAddToCart(false)}
                className="min-w-[180px] rounded-radius-m"
              >
                Thêm vào giỏ hàng
              </Button>

              <Button
                size="large"
                type="primary"
                icon={<ThunderboltOutlined />}
                disabled={!canOperate}
                onClick={() => handleAddToCart(true)}
                className="min-w-[180px] rounded-radius-m"
              >
                Mua ngay
              </Button>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]} className="mt-24">
        <Col span={24}>
          <Card
            title="Thông tin sản phẩm"
            bordered={false}
            className="rounded-radius-xl shadow-down-s"
          >
            {product.description ? (
              <>
                <div className="mb-16 whitespace-pre-wrap text-15 leading-24 text-color-800">
                  {product.description}
                </div>
                <Divider />
              </>
            ) : null}

            <Descriptions bordered column={1} size="middle" labelStyle={{ width: 220 }}>
              <Descriptions.Item label="Mã sản phẩm">
                {product.id || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Tên sản phẩm">
                {product.name || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Danh mục cha">
                {categoryInfo.parentName || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Danh mục con">
                {categoryInfo.childName || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Code category">
                {product.category || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Bảo hành">
                {(product as any)?.guarantee || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Xuất xứ">
                {(product as any)?.origin || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Chất lượng">
                {(product as any)?.quality || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                {STATUS_CONVERT[product.status] || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Thuộc tính chung">
                {(product as any)?.attributes ? (
                  <div className="flex flex-wrap gap-8">
                    {Object.entries((product as any).attributes).map(([key, value]) => (
                      <Tag key={key}>
                        {key}: {String(value)}
                      </Tag>
                    ))}
                  </div>
                ) : (
                  "-"
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Tất cả biến thể">
                {Array.isArray(product.variants) && product.variants.length ? (
                  <div className="flex flex-col gap-8">
                    {product.variants.map((variant: any, index: number) => {
                      const rowPrices = getVisiblePriceRows(product, typeUser, index);

                      return (
                        <div
                          key={`${product.id}_${index}`}
                          className="rounded-radius-m border border-color-300 p-12"
                        >
                          <div className="mb-4 font-medium">Biến thể {index + 1}</div>
                          <div className="mb-4 text-14 text-color-800">
                            {getVariantLabel(variant)}
                          </div>
                          <div className="mb-8 text-14 text-color-700">
                            Tồn kho: {Number(variant?.stock || 0)}
                          </div>

                          <div className="flex flex-col gap-4">
                            {rowPrices.map((row) => (
                              <div
                                key={`${index}_${row.key}`}
                                className="flex items-center justify-between text-14"
                              >
                                <span className="text-color-700">{row.label}</span>
                                <span className="font-medium text-color-900">
                                  {formatCurrency(row.value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  "-"
                )}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]} className="mt-24">
        <Col span={24}>
          <Card
            title="Đánh giá sản phẩm"
            bordered={false}
            className="rounded-radius-xl shadow-down-s"
          >
            <Form
              form={reviewForm}
              layout="vertical"
              onFinish={handleSubmitReview}
              initialValues={{ rating: 5 }}
            >
              <Row gutter={16}>
                <Col span={24}>
                  <Form.Item
                    name="rating"
                    label="Số sao"
                    rules={[{ required: true, message: "Vui lòng chọn số sao" }]}
                  >
                    <Rate />
                  </Form.Item>
                </Col>

                <Col span={24}>
                  <Form.Item
                    name="content"
                    label="Nội dung đánh giá"
                    rules={[{ required: true, message: "Vui lòng nhập nội dung đánh giá" }]}
                  >
                    <Input.TextArea
                      rows={4}
                      placeholder="Nhập cảm nhận của bạn về sản phẩm"
                    />
                  </Form.Item>
                </Col>

                <Col span={24}>
                  <Form.Item label="Ảnh đánh giá">
                    <Upload
                      multiple
                      listType="picture"
                      beforeUpload={handleBeforeUpload}
                      onRemove={handleRemoveReviewFile}
                      fileList={reviewFileList}
                    >
                      <Button icon={<UploadOutlined />}>Chọn ảnh</Button>
                    </Upload>
                  </Form.Item>
                </Col>
              </Row>

              <div className="flex justify-end">
                <Button
                  htmlType="submit"
                  type="primary"
                  loading={reviewSubmitting}
                  className="rounded-radius-m"
                >
                  Gửi đánh giá
                </Button>
              </div>
            </Form>

            <Divider />

            <div className="mb-16 flex items-center gap-12">
              <Rate disabled allowHalf value={averageRating} />
              <span className="text-14 text-color-700">
                {reviews.length} đánh giá
              </span>
            </div>

            {reviews.length ? (
              <List
                dataSource={reviews}
                itemLayout="vertical"
                renderItem={(item) => (
                  <List.Item key={item.id}>
                    <div className="rounded-radius-l border border-color-300 p-16">
                      <div className="mb-12 flex items-start gap-12">
                        <Avatar>
                          {(item.userName || "U").charAt(0).toUpperCase()}
                        </Avatar>

                        <div className="flex-1">
                          <div className="mb-4 text-15 font-medium text-color-900">
                            {item.userName}
                          </div>
                          <div className="mb-4">
                            <Rate disabled value={item.rating} />
                          </div>
                          <div className="text-13 text-color-700">
                            {dayjs(item.createdAt).format("DD/MM/YYYY HH:mm")}
                          </div>
                        </div>
                      </div>

                      <div className="mb-12 whitespace-pre-wrap text-15 leading-24 text-color-800">
                        {item.content}
                      </div>

                      {item.imageUrls?.length ? (
                        <div className="grid grid-cols-4 gap-12 mobile:grid-cols-2">
                          {item.imageUrls.map((url, index) => (
                            <div
                              key={`${item.id}_${index}`}
                              className="overflow-hidden rounded-radius-m border border-color-300"
                            >
                              <Image
                                src={url}
                                alt={`review_${index}`}
                                className="h-[120px] w-full object-cover"
                              />
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="Chưa có đánh giá nào" />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}