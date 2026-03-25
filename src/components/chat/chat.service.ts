import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/App";
import type {
  ChatMessage,
  ConversationRecord,
  MessageType,
  UserRecord,
} from "./chat.type";
import { getGuestSessionId } from "./chatSession";

type NullableProfile = UserRecord | null | undefined;

export type ProductData = {
  id: string;
  name: string;
  price?: number | null;
  image?: string | null;
  slug?: string | null;
};

export const getCustomerKey = (currentUserProfile?: NullableProfile) => {
  if (currentUserProfile?.id) {
    return `user_${currentUserProfile.id}`;
  }

  return getGuestSessionId();
};

export const getCurrentCustomerSenderId = (
  currentUserProfile?: NullableProfile,
) => {
  if (currentUserProfile?.id) {
    return `user_${currentUserProfile.id}`;
  }

  return getGuestSessionId();
};

export const getConversationQueryIdentity = (
  currentUserProfile?: NullableProfile,
) => {
  const customerKey = getCustomerKey(currentUserProfile);

  return {
    customerKey,
    guestSessionId: currentUserProfile?.id ? null : customerKey,
    customerUserId: currentUserProfile?.id ?? null,
  };
};

export const findOpenConversationByCustomerKey = async (
  currentUserProfile?: NullableProfile,
) => {
  const { customerKey } = getConversationQueryIdentity(currentUserProfile);

  const q = query(
    collection(db, "conversations"),
    where("customerKey", "==", customerKey),
    where("isClosed", "==", false),
    limit(1),
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;

  const docSnap = snapshot.docs[0];
  return {
    id: docSnap.id,
    ...(docSnap.data() as Omit<ConversationRecord, "id">),
  } as ConversationRecord;
};

export const createConversation = async (
  currentUserProfile?: NullableProfile,
) => {
  const { customerKey, guestSessionId, customerUserId } =
    getConversationQueryIdentity(currentUserProfile);

  const payload = {
    customerKey,
    customerUserId,
    guestSessionId,
    customerName: currentUserProfile?.name ?? null,
    customerEmail: currentUserProfile?.email ?? null,
    customerPhone: currentUserProfile?.phoneNumber ?? null,
    assignedStaffId: null,
    botEnabled: true,
    botPending: false,
    pendingMessageId: null,
    isClosed: false,
    lastMessage: null,
    lastMessageType: null,
    lastSenderId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, "conversations"), payload);
  return ref.id;
};

export const getOrCreateConversation = async (
  currentUserProfile?: NullableProfile,
) => {
  const found = await findOpenConversationByCustomerKey(currentUserProfile);

  if (found?.id) return found.id;

  return createConversation(currentUserProfile);
};

export const claimGuestConversationToUser = async (
  currentUserProfile?: NullableProfile,
) => {
  if (!currentUserProfile?.id) return null;

  const userCustomerKey = `user_${currentUserProfile.id}`;
  const guestSessionId = getGuestSessionId();

  const userQuery = query(
    collection(db, "conversations"),
    where("customerKey", "==", userCustomerKey),
    where("isClosed", "==", false),
    limit(1),
  );

  const userSnapshot = await getDocs(userQuery);
  if (!userSnapshot.empty) {
    return userSnapshot.docs[0].id;
  }

  const guestQuery = query(
    collection(db, "conversations"),
    where("customerKey", "==", guestSessionId),
    where("isClosed", "==", false),
    limit(1),
  );

  const guestSnapshot = await getDocs(guestQuery);

  if (guestSnapshot.empty) {
    return null;
  }

  const guestDoc = guestSnapshot.docs[0];
  await updateDoc(doc(db, "conversations", guestDoc.id), {
    customerKey: userCustomerKey,
    customerUserId: currentUserProfile.id,
    customerName: currentUserProfile.name ?? null,
    customerEmail: currentUserProfile.email ?? null,
    customerPhone: currentUserProfile.phoneNumber ?? null,
    updatedAt: serverTimestamp(),
  });

  return guestDoc.id;
};

export const sendTextMessage = async ({
  conversationId,
  currentUserProfile,
  text,
  clientMessageId,
}: {
  conversationId: string;
  currentUserProfile?: NullableProfile;
  text: string;
  clientMessageId: string;
}) => {
  const senderId = getCurrentCustomerSenderId(currentUserProfile);

  const messageRef = doc(
    db,
    "conversations",
    conversationId,
    "messages",
    clientMessageId,
  );

  const payload = {
    senderId,
    senderRole: "customer",
    type: "text" as MessageType,
    text,
    imageUrl: null,
    product: null,
    createdAt: serverTimestamp(),
    seenBy: [],
    metadata: {
      clientMessageId,
    },
  };

  await setDoc(messageRef, payload, { merge: false });

  await updateDoc(doc(db, "conversations", conversationId), {
    lastMessage: text,
    lastMessageType: "text",
    lastSenderId: senderId,
    updatedAt: serverTimestamp(),
  });
};

export const sendBotTextMessage = async ({
  conversationId,
  text,
  matchedFaqKey,
}: {
  conversationId: string;
  text: string;
  matchedFaqKey?: string | null;
}) => {
  await addDoc(collection(db, "conversations", conversationId, "messages"), {
    senderId: "bot_support",
    senderRole: "bot",
    type: "text",
    text,
    imageUrl: null,
    product: null,
    createdAt: serverTimestamp(),
    seenBy: [],
    metadata: {
      matchedFaqKey: matchedFaqKey || null,
      source: "local_faq_bot",
    },
  });

  await updateDoc(doc(db, "conversations", conversationId), {
    lastMessage: text,
    lastMessageType: "text",
    lastSenderId: "bot_support",
    updatedAt: serverTimestamp(),
  });
};

export const sendBotProductMessage = async ({
  conversationId,
  product,
}: {
  conversationId: string;
  product: ProductData;
}) => {
  await addDoc(collection(db, "conversations", conversationId, "messages"), {
    senderId: "bot_support",
    senderRole: "bot",
    type: "product",
    text: null,
    imageUrl: null,
    product: {
      id: product.id,
      name: product.name,
      price: product.price ?? null,
      image: product.image ?? null,
      slug: product.slug ?? null,
    },
    createdAt: serverTimestamp(),
    seenBy: [],
    metadata: {
      source: "local_faq_bot",
    },
  });

  await updateDoc(doc(db, "conversations", conversationId), {
    lastMessage: product.name,
    lastMessageType: "product",
    lastSenderId: "bot_support",
    updatedAt: serverTimestamp(),
  });
};

const mapProductDoc = (id: string, raw: any): ProductData => {
  const image =
    typeof raw?.image === "string"
      ? raw.image
      : Array.isArray(raw?.images) && typeof raw.images[0] === "string"
        ? raw.images[0]
        : typeof raw?.thumbnail === "string"
          ? raw.thumbnail
          : null;

  const price =
    typeof raw?.price === "number"
      ? raw.price
      : typeof raw?.salePrice === "number"
        ? raw.salePrice
        : typeof raw?.finalPrice === "number"
          ? raw.finalPrice
          : null;

  return {
    id,
    name: raw?.name || raw?.productName || raw?.title || "Sản phẩm",
    price,
    image,
    slug: raw?.slug || raw?.seoSlug || null,
  };
};

export const getProductsByIds = async (productIds: string[]) => {
  const uniqueIds = Array.from(new Set(productIds)).filter(Boolean);

  if (!uniqueIds.length) {
    return [];
  }

  const docs = await Promise.all(
    uniqueIds.map((id) => getDoc(doc(db, "Products", id))),
  );

  return docs
    .filter((item) => item.exists())
    .map((item) => mapProductDoc(item.id, item.data()));
};

export const searchProductsByMessage = async (message: string) => {
  const normalizedMessage = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalizedMessage) {
    return [];
  }

  const snapshot = await getDocs(
    query(collection(db, "Products"), limit(50)),
  );

  const scored = snapshot.docs
    .map((item) => {
      const raw = item.data();
      const product = mapProductDoc(item.id, raw);

      const haystack = [
        product.name,
        product.slug || "",
        raw?.description || "",
        raw?.shortDescription || "",
        raw?.categoryName || "",
        raw?.brand || "",
      ]
        .join(" ")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      let score = 0;
      const tokens = normalizedMessage.split(" ").filter((x) => x.length >= 2);

      for (const token of tokens) {
        if (haystack.includes(token)) {
          score += 1;
        }
      }

      if (normalizedMessage.includes("bon tam") && haystack.includes("bon tam")) {
        score += 2;
      }

      if (
        normalizedMessage.includes("massage") &&
        haystack.includes("massage")
      ) {
        score += 2;
      }

      return {
        product,
        score,
      };
    })
    .filter((item) => item.score > 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => item.product);

  return scored;
};

export const subscribeConversationMessages = (
  conversationId: string,
  callback: (messages: ChatMessage[]) => void,
): Unsubscribe => {
  const q = query(
    collection(db, "conversations", conversationId, "messages"),
    orderBy("createdAt", "asc"),
  );

  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map((item) => {
      return {
        id: item.id,
        ...(item.data() as Omit<ChatMessage, "id">),
      };
    }) as ChatMessage[];

    callback(data);
  });
};

export const subscribeConversation = (
  conversationId: string,
  callback: (conversation: ConversationRecord | null) => void,
): Unsubscribe => {
  return onSnapshot(doc(db, "conversations", conversationId), (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }

    callback({
      id: snapshot.id,
      ...(snapshot.data() as Omit<ConversationRecord, "id">),
    });
  });
};