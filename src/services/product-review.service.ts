import dayjs from "dayjs";
import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import {
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";
import { db, storage } from "@/App";
import type { ProductReviewDoc } from "./order.types";

export const getProductReviews = async (productId: string) => {
  const q = query(
    collection(db, "ProductReviews"),
    where("productId", "==", productId),
    where("status", "==", "VISIBLE"),
    orderBy("createdAt", "desc"),
  );

  const snap = await getDocs(q);

  return snap.docs.map((docItem) => ({
    id: docItem.id,
    ...docItem.data(),
  })) as ProductReviewDoc[];
};

export const uploadReviewImages = async (
  productId: string,
  userId: string,
  files: File[],
) => {
  const urls = await Promise.all(
    files.map(async (file) => {
      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}.${ext}`;

      const storageRef = ref(
        storage,
        `product-reviews/${productId}/${userId}/${fileName}`,
      );

      await uploadBytes(storageRef, file);
      return getDownloadURL(storageRef);
    }),
  );

  return urls;
};

export const createProductReview = async (payload: {
  productId: string;
  productName: string;
  idUser: string;
  userName: string;
  userEmail?: string;
  rating: number;
  content: string;
  imageUrls: string[];
}) => {
  const now = dayjs().toISOString();

  const docRef = await addDoc(collection(db, "ProductReviews"), {
    ...payload,
    status: "VISIBLE",
    createdAt: now,
    updatedAt: now,
  });

  return {
    id: docRef.id,
    ...payload,
    status: "VISIBLE",
    createdAt: now,
    updatedAt: now,
  };
};