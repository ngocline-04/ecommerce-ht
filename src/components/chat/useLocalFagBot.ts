import faqData from "../../assets/json/faq-bot-100.json";

type FaqItem = {
  key: string;
  question: string;
  keywords: string[];
  answer: string;
  productIds?: string[];
  priority?: number;
};

type ProductData = {
  id: string;
  name: string;
  category?: string | null;
  description?: string | null;
  image?: string | null;
  slug?: string | null;
  status?: string | null;
  sizes: string[];
  minPrice?: number | null;
  maxPrice?: number | null;
  material?: string | null;
  color?: string | null;
  raw?: unknown;
};

type UseLocalFaqBotParams = {
  searchProductsByIds: (productIds: string[]) => Promise<ProductData[]>;
  searchProductsByMessage: (message: string) => Promise<ProductData[]>;
};

type BotReplyResult = {
  matchedFaqKey: string | null;
  replyText: string;
  products: ProductData[];
};

const FAQ_DATA = faqData as FaqItem[];

const BOT_DELAY_MS = 1200;

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const normalizeText = (value: string) => {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const SMALL_TALK_PATTERNS = {
  thanks: [
    "cam on",
    "cảm ơn",
    "thank",
    "thanks",
    "thank you",
    "tks",
    "thx",
    "ok cam on",
    "ok cảm ơn",
    "da cam on",
    "dạ cảm ơn",
  ],
  greeting: [
    "xin chao",
    "xin chào",
    "chao shop",
    "chào shop",
    "hello",
    "hi",
    "alo",
    "shop oi",
    "shop ơi",
  ],
  farewell: [
    "tam biet",
    "tạm biệt",
    "bye",
    "goodbye",
    "hen gap lai",
    "hẹn gặp lại",
  ],
  confirm: [
    "ok",
    "oke",
    "oki",
    "okie",
    "vang",
    "vâng",
    "da",
    "dạ",
    "uh",
    "ừ",
    "duoc",
    "được",
    "roi",
    "rồi",
  ],
};

const GENERIC_TOKENS = new Set([
  "co",
  "khong",
  "bao",
  "gia",
  "nhieu",
  "loai",
  "nao",
  "mau",
  "dep",
  "tot",
  "tu",
  "van",
  "the",
  "sao",
  "ra",
  "dat",
  "bao hanh",
  "phu",
  "hop",
  "nha",
  "nho",
  "may",
  "voi",
  "sen",
  "bon",
  "tuong",
  "am",
]);

const includesAnyPattern = (normalizedTextValue: string, patterns: string[]) => {
  return patterns.some((item) => normalizedTextValue.includes(normalizeText(item)));
};

const detectSmallTalkIntent = (message: string) => {
  const normalized = normalizeText(message);

  if (!normalized) return null;

  if (includesAnyPattern(normalized, SMALL_TALK_PATTERNS.thanks)) {
    return "thanks";
  }

  if (includesAnyPattern(normalized, SMALL_TALK_PATTERNS.greeting)) {
    return "greeting";
  }

  if (includesAnyPattern(normalized, SMALL_TALK_PATTERNS.farewell)) {
    return "farewell";
  }

  if (
    includesAnyPattern(normalized, SMALL_TALK_PATTERNS.confirm) &&
    normalized.split(" ").length <= 3
  ) {
    return "confirm";
  }

  return null;
};

const getSmallTalkReply = (intent: string) => {
  switch (intent) {
    case "thanks":
      return "Dạ em cảm ơn anh/chị ạ. Nếu mình cần em tư vấn thêm sản phẩm nào thì cứ nhắn em nhé.";
    case "greeting":
      return "Dạ em chào anh/chị ạ 👋 Anh/chị đang quan tâm sản phẩm nào để em hỗ trợ nhanh nhé.";
    case "farewell":
      return "Dạ em cảm ơn anh/chị ạ. Khi nào cần hỗ trợ thêm mình cứ nhắn lại cho em nhé.";
    case "confirm":
      return "Dạ vâng ạ. Anh/chị cần em tư vấn tiếp sản phẩm nào thì cứ nhắn em nhé.";
    default:
      return "Dạ em sẵn sàng hỗ trợ anh/chị ạ.";
  }
};

const extractBudget = (message: string) => {
  const normalized = normalizeText(message);

  const patterns = [
    /(\d+)\s*trieu/,
    /(\d+)\s*tr\b/,
    /(\d+)\s*cu\b/,
    /(\d+)\s*000\s*000/,
  ];

  for (const pattern of patterns) {
    const matched = normalized.match(pattern);

    if (!matched?.[1]) continue;

    const value = Number(matched[1]);

    if (Number.isNaN(value)) continue;

    if (pattern.source.includes("000")) {
      return value;
    }

    return value * 1000000;
  }

  return null;
};

const extractSizeTokens = (message: string) => {
  const raw = message.toLowerCase();
  const found = new Set<string>();

  const patterns = [
    /\b\d{3,4}x\d{3,4}(x\d{3,4})?\b/g,
    /\b1m[0-9]\b/g,
    /\b2m\b/g,
    /\b\d{3,4}\b/g,
  ];

  for (const pattern of patterns) {
    const matches = raw.match(pattern) || [];
    for (const item of matches) {
      found.add(item.trim());
    }
  }

  return Array.from(found);
};

const isBudgetOnlyMessage = (message: string) => {
  const normalized = normalizeText(message);
  const budget = extractBudget(message);

  return (
    Boolean(budget) ||
    normalized.includes("ngan sach") ||
    normalized.includes("tam tien") ||
    normalized.includes("muc gia") ||
    normalized.includes("gia tam") ||
    /^[0-9\s.,trieu]+$/.test(normalized)
  );
};

const isSizeOnlyMessage = (message: string) => {
  const normalized = normalizeText(message);
  const sizeTokens = extractSizeTokens(message);

  return (
    sizeTokens.length > 0 ||
    normalized.includes("kich thuoc") ||
    normalized.includes("size") ||
    normalized.includes("dai") ||
    normalized.includes("rong") ||
    normalized.includes("ngang") ||
    /^[0-9mx\s.,]+$/.test(normalized)
  );
};

const shouldSearchProducts = (
  customerText: string,
  matchedFaq: FaqItem | null,
  smallTalkIntent: string | null,
) => {
  if (smallTalkIntent) return false;

  const normalized = normalizeText(customerText);

  return (
    Boolean(matchedFaq?.productIds?.length) ||
    Boolean(matchedFaq?.key?.includes("goi_y")) ||
    Boolean(matchedFaq?.key?.includes("budget")) ||
    Boolean(matchedFaq?.key?.includes("size")) ||
    normalized.includes("bon tam") ||
    normalized.includes("massage") ||
    normalized.includes("lavabo") ||
    normalized.includes("sen voi") ||
    normalized.includes("voi sen") ||
    normalized.includes("bon cau") ||
    normalized.includes("guong") ||
    normalized.includes("phong tam") ||
    normalized.includes("voi bep") ||
    normalized.includes("sen am tuong") ||
    isBudgetOnlyMessage(customerText) ||
    isSizeOnlyMessage(customerText)
  );
};

const scoreFaqItem = (message: string, faq: FaqItem) => {
  const normalizedMessage = normalizeText(message);
  let score = 0;

  for (const keyword of faq.keywords) {
    const normalizedKeyword = normalizeText(keyword);

    if (!normalizedKeyword) continue;

    if (normalizedMessage.includes(normalizedKeyword)) {
      const tokenCount = normalizedKeyword.split(" ").filter(Boolean).length;

      if (tokenCount >= 3) {
        score += 8;
      } else if (tokenCount === 2) {
        score += 5;
      } else if (!GENERIC_TOKENS.has(normalizedKeyword)) {
        score += 2;
      }
    }

    const tokens = normalizedKeyword.split(" ").filter(Boolean);

    for (const token of tokens) {
      if (token.length < 2) continue;
      if (GENERIC_TOKENS.has(token)) continue;

      if (normalizedMessage.includes(token)) {
        score += 1;
      }
    }
  }

  const normalizedQuestion = normalizeText(faq.question);

  if (normalizedQuestion && normalizedMessage.includes(normalizedQuestion)) {
    score += 10;
  }

  if (faq.key.includes("budget") && isBudgetOnlyMessage(message)) {
    score += 6;
  }

  if (faq.key.includes("size") && isSizeOnlyMessage(message)) {
    score += 6;
  }

  score += faq.priority || 0;

  return score;
};

const findBestFaq = (message: string, faqList: FaqItem[]) => {
  let bestItem: FaqItem | null = null;
  let bestScore = 0;

  for (const faq of faqList) {
    const score = scoreFaqItem(message, faq);

    if (score > bestScore) {
      bestScore = score;
      bestItem = faq;
    }
  }

  const normalized = normalizeText(message);
  const wordCount = normalized ? normalized.split(" ").length : 0;
  const minScore = wordCount <= 2 ? 10 : 8;

  if (!bestItem || bestScore < minScore) {
    return null;
  }

  return bestItem;
};

const getFallbackReply = (customerText: string) => {
  if (isBudgetOnlyMessage(customerText)) {
    return (
      "Dạ anh/chị đang nhắc tới mức ngân sách phải không ạ? " +
      "Anh/chị cho em biết mình đang quan tâm sản phẩm nào như " +
      "bồn tắm, lavabo, sen vòi... để em gợi ý đúng tầm giá nhé."
    );
  }

  if (isSizeOnlyMessage(customerText)) {
    return (
      "Dạ anh/chị đang hỏi về kích thước đúng không ạ? " +
      "Anh/chị gửi giúp em loại sản phẩm hoặc kích thước theo dạng " +
      "dài x rộng như 1500x750 để em gợi ý chuẩn hơn nhé."
    );
  }

  return (
    "Dạ em đã nhận được câu hỏi của anh/chị. " +
    "Anh/chị có thể nhắn rõ hơn về sản phẩm, kích thước, " +
    "ngân sách hoặc để lại số điện thoại để nhân viên bên em hỗ trợ nhanh nhé."
  );
};

export const useLocalFaqBot = ({
  searchProductsByIds,
  searchProductsByMessage,
}: UseLocalFaqBotParams) => {
  const getBotReply = async (customerText: string): Promise<BotReplyResult> => {
    const trimmed = customerText.trim();
    const smallTalkIntent = detectSmallTalkIntent(trimmed);

    if (smallTalkIntent) {
      return {
        matchedFaqKey: `smalltalk_${smallTalkIntent}`,
        replyText: getSmallTalkReply(smallTalkIntent),
        products: [],
      };
    }

    const matchedFaq = findBestFaq(trimmed, FAQ_DATA);

    const replyText = matchedFaq
      ? matchedFaq.answer
      : getFallbackReply(trimmed);

    let products: ProductData[] = [];

    if (matchedFaq?.productIds && matchedFaq.productIds.length > 0) {
      products = await searchProductsByIds(matchedFaq.productIds);
    } else if (shouldSearchProducts(trimmed, matchedFaq, smallTalkIntent)) {
      products = await searchProductsByMessage(trimmed);
    }

    return {
      matchedFaqKey: matchedFaq?.key || null,
      replyText,
      products,
    };
  };

  const waitBotDelay = async () => {
    await sleep(BOT_DELAY_MS);
  };

  return {
    getBotReply,
    waitBotDelay,
  };
};