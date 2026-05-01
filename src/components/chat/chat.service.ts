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
  writeBatch,
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
    customerId: currentUserProfile?.id ?? null,
  };
};

const mapConversationDoc = (docSnap: any): ConversationRecord => {
  return {
    id: docSnap.id,
    ...(docSnap.data() as Omit<ConversationRecord, "id">),
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
    limit(10),
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;

  const docs = snapshot.docs.map(mapConversationDoc);

  docs.sort((a, b) => {
    const aTime = a.updatedAt?.seconds || a.createdAt?.seconds || 0;
    const bTime = b.updatedAt?.seconds || b.createdAt?.seconds || 0;
    return bTime - aTime;
  });

  return docs[0];
};

export const createConversation = async (
  currentUserProfile?: NullableProfile,
) => {
  const { customerKey, guestSessionId, customerUserId, customerId } =
    getConversationQueryIdentity(currentUserProfile);

  const payload = {
    customerKey,
    customerUserId,
    customerId,
    guestSessionId,
    customerName: currentUserProfile?.name ?? null,
    customerEmail: currentUserProfile?.email ?? null,
    customerPhone: currentUserProfile?.phoneNumber ?? null,
    customerAvatar: null,
    assignedStaffId: null,
    staffId: null,
    staffName: null,
    participants: customerUserId ? [customerUserId] : [customerKey],
    unreadCustomer: 0,
    unreadStaff: 0,
    botEnabled: true,
    botPending: false,
    pendingMessageId: null,
    isClosed: false,
    lastMessage: null,
    lastMessageType: null,
    lastSenderId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    status: "OPEN",
  };

  const ref = await addDoc(collection(db, "conversations"), payload);
  return ref.id;
};

const mergeConversationMessages = async (
  sourceConversationId: string,
  targetConversationId: string,
) => {
  if (!sourceConversationId || !targetConversationId) return;
  if (sourceConversationId === targetConversationId) return;

  const sourceMessagesSnap = await getDocs(
    query(
      collection(db, "conversations", sourceConversationId, "messages"),
      orderBy("createdAt", "asc"),
    ),
  );

  if (sourceMessagesSnap.empty) return;

  const batch = writeBatch(db);

  sourceMessagesSnap.docs.forEach((item) => {
    const targetRef = doc(
      db,
      "conversations",
      targetConversationId,
      "messages",
      item.id,
    );

    batch.set(targetRef, item.data(), { merge: true });
  });

  await batch.commit();
};

const closeConversation = async (conversationId: string) => {
  await updateDoc(doc(db, "conversations", conversationId), {
    isClosed: true,
    status: "MERGED",
    updatedAt: serverTimestamp(),
  });
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
    limit(10),
  );

  const userSnapshot = await getDocs(userQuery);
  const userDocs = userSnapshot.docs;

  const guestQuery = query(
    collection(db, "conversations"),
    where("customerKey", "==", guestSessionId),
    where("isClosed", "==", false),
    limit(10),
  );

  const guestSnapshot = await getDocs(guestQuery);
  const guestDocs = guestSnapshot.docs;

  if (userDocs.length > 0) {
    const mainUserDoc = userDocs[0];

    await updateDoc(doc(db, "conversations", mainUserDoc.id), {
      customerKey: userCustomerKey,
      customerUserId: currentUserProfile.id,
      customerId: currentUserProfile.id,
      customerName: currentUserProfile.name ?? null,
      customerEmail: currentUserProfile.email ?? null,
      customerPhone: currentUserProfile.phoneNumber ?? null,
      participants: [currentUserProfile.id],
      updatedAt: serverTimestamp(),
    });

    for (const guestDoc of guestDocs) {
      if (guestDoc.id === mainUserDoc.id) continue;

      await mergeConversationMessages(guestDoc.id, mainUserDoc.id);
      await closeConversation(guestDoc.id);
    }

    for (let i = 1; i < userDocs.length; i += 1) {
      const duplicateUserDoc = userDocs[i];
      await mergeConversationMessages(duplicateUserDoc.id, mainUserDoc.id);
      await closeConversation(duplicateUserDoc.id);
    }

    return mainUserDoc.id;
  }

  if (guestDocs.length > 0) {
    const mainGuestDoc = guestDocs[0];

    await updateDoc(doc(db, "conversations", mainGuestDoc.id), {
      customerKey: userCustomerKey,
      customerUserId: currentUserProfile.id,
      customerId: currentUserProfile.id,
      guestSessionId,
      customerName: currentUserProfile.name ?? null,
      customerEmail: currentUserProfile.email ?? null,
      customerPhone: currentUserProfile.phoneNumber ?? null,
      participants: [currentUserProfile.id],
      updatedAt: serverTimestamp(),
    });

    for (let i = 1; i < guestDocs.length; i += 1) {
      const duplicateGuestDoc = guestDocs[i];
      await mergeConversationMessages(duplicateGuestDoc.id, mainGuestDoc.id);
      await closeConversation(duplicateGuestDoc.id);
    }

    return mainGuestDoc.id;
  }

  return null;
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
    unreadStaff: 0,
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

export const shouldSkipBotReply = (text: string) => {
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return true;

  const skipMessages = [
    "ok",
    "oke",
    "oki",
    "okie",
    "vang",
    "da",
    "uh",
    "uhm",
    "um",
    "a",
    "e",
    "roi",
    "duoc",
    "cam on",
    "thanks",
    "thank you",
    "bye",
    "tam biet",
  ];

  if (skipMessages.includes(normalized)) {
    return true;
  }

  const wordCount = normalized.split(" ").filter(Boolean).length;

  if (wordCount <= 1) {
    return true;
  }

  return false;
};