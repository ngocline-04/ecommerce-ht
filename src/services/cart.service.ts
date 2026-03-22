import dayjs from "dayjs";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/App";

export type CartPendingItem = {
  id: string;
  idUser: string;
  productId: string;
  productName: string;
  productImage: string;
  category: string;

  variantId?: string;
  variantIndex?: number;
  variantLabel?: string;
  variantAttributes?: Record<string, any>;

  quantity: number;
  unitPrice: number;
  lineTotal: number;
  typeUser: "BTC" | "BTB" | "CTV";
  promotion: {
    campaignId: string;
    campaignName: string;
    discountType: "percent" | "amount";
    discountValue: number;
  } | null;
  checked: boolean;
  createdAt: string;
  updatedAt: string;
};

export const subscribeCartPending = (
  userId: string,
  callback: (items: CartPendingItem[]) => void,
) => {
  const q = query(collection(db, "CartPending"), where("idUser", "==", userId));

  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    })) as CartPendingItem[];

    callback(
      data.sort(
        (a, b) => dayjs(b.updatedAt || 0).valueOf() - dayjs(a.updatedAt || 0).valueOf(),
      ),
    );
  });
};

export const addToCartPending = async (
  payload: Omit<CartPendingItem, "id" | "createdAt" | "updatedAt">,
) => {
  const q = query(
    collection(db, "CartPending"),
    where("idUser", "==", payload.idUser),
    where("productId", "==", payload.productId),
    where("variantId", "==", payload.variantId || ""),
  );

  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    const existedDoc = snapshot.docs[0];
    const existedData = existedDoc.data() as CartPendingItem;

    const nextQuantity =
      Number(existedData.quantity || 0) + Number(payload.quantity || 0);
    const nextLineTotal = Number(payload.unitPrice || 0) * nextQuantity;

    await updateDoc(doc(db, "CartPending", existedDoc.id), {
      quantity: nextQuantity,
      unitPrice: Number(payload.unitPrice || 0),
      lineTotal: nextLineTotal,
      typeUser: payload.typeUser,
      promotion: payload.promotion || null,
      variantId: payload.variantId || "",
      variantIndex:
        typeof payload.variantIndex === "number" ? payload.variantIndex : 0,
      variantLabel: payload.variantLabel || "",
      variantAttributes: payload.variantAttributes || {},
      checked: true,
      updatedAt: dayjs().toISOString(),
    });

    return existedDoc.id;
  }

  const created = await addDoc(collection(db, "CartPending"), {
    ...payload,
    variantId: payload.variantId || "",
    variantIndex:
      typeof payload.variantIndex === "number" ? payload.variantIndex : 0,
    variantLabel: payload.variantLabel || "",
    variantAttributes: payload.variantAttributes || {},
    quantity: Number(payload.quantity || 1),
    unitPrice: Number(payload.unitPrice || 0),
    lineTotal: Number(payload.unitPrice || 0) * Number(payload.quantity || 1),
    promotion: payload.promotion || null,
    checked: true,
    createdAt: dayjs().toISOString(),
    updatedAt: dayjs().toISOString(),
  });

  return created.id;
};

export const updateCartPendingQuantity = async (
  cartId: string,
  quantity: number,
  unitPrice: number,
) => {
  const safeQty = Math.max(1, Number(quantity || 1));

  await updateDoc(doc(db, "CartPending", cartId), {
    quantity: safeQty,
    unitPrice: Number(unitPrice || 0),
    lineTotal: Number(unitPrice || 0) * safeQty,
    updatedAt: dayjs().toISOString(),
  });
};

export const removeCartPendingItem = async (cartId: string) => {
  await deleteDoc(doc(db, "CartPending", cartId));
};

export const toggleCartPendingChecked = async (cartId: string, checked: boolean) => {
  await updateDoc(doc(db, "CartPending", cartId), {
    checked,
    updatedAt: dayjs().toISOString(),
  });
};