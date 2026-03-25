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
) => {
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
      score += 3;
    }

    const tokens = normalizedKeyword.split(" ").filter(Boolean);

    for (const token of tokens) {
      if (token.length < 2) continue;

      if (normalizedMessage.includes(token)) {
        score += 1;
      }
    }
  }

  const normalizedQuestion = normalizeText(faq.question);

  if (normalizedQuestion && normalizedMessage.includes(normalizedQuestion)) {
    score += 4;
  }

  if (faq.key.includes("budget") && isBudgetOnlyMessage(message)) {
    score += 4;
  }

  if (faq.key.includes("size") && isSizeOnlyMessage(message)) {
    score += 4;
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

  if (!bestItem || bestScore < 4) {
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
    const matchedFaq = findBestFaq(trimmed, FAQ_DATA);

    const replyText = matchedFaq
      ? matchedFaq.answer
      : getFallbackReply(trimmed);

    let products: ProductData[] = [];

    if (matchedFaq?.productIds && matchedFaq.productIds.length > 0) {
      products = await searchProductsByIds(matchedFaq.productIds);
    } else if (shouldSearchProducts(trimmed, matchedFaq)) {
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