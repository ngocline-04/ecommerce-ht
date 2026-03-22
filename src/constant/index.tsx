const STATUS = {
  CREATED: "CREATED",
  WAITING_APPROVE: "WAITING_APPROVE",
  APPROVED: "APPROVED",
  WAITING_APPROVE_UPDATE: "PENDING_FOR_EDIT_APPROVAL",
  REJECT: "REJECT",
  EXPIRED: "EXPIRED",
  EFFECTIVE: "EFFECTIVE",
};

const ROLE_KEYCLOAK = {
  ADMIN: "NHS/CARD/ROLE_ADMIN",
  CUSTOMER_MANAGEMENT: "NHS/CARD/ROLE_CUSTOMER_MANAGEMENT",
};

export const ROLE_NAME = {};

const STATUS_CONVERT: any = {
  PENDING: "Chờ duyệt",
  AVAILABLE: "Khả dụng để bán",
  HOLD: "Đã chọn số",
  SOLD: "Khách đã thực hiện trả phí mở TK thành công",
  USED: "Đã mở tài khoản thành công",
};

export const STATUS_COLOR = {
  PENDING: "text-pending-500",
  AVAILABLE: "text-success-500",
  HOLD: "text-error-500",
  SOLD: "text-link-500",
  USED: "text-primary-500",
};

export const typeStatus = [
  {
    label: STATUS_CONVERT.USED,
    value: "USED",
  },
  {
    label: STATUS_CONVERT.HOLD,
    value: "HOLD",
  },
  {
    label: STATUS_CONVERT.AVAILABLE,
    value: "AVAILABLE",
  },
  {
    label: STATUS_CONVERT.SOLD,
    value: "SOLD",
  },
  {
    label: STATUS_CONVERT.PENDING,
    value: "PENDING",
  },
];

export { STATUS, STATUS_CONVERT, ROLE_KEYCLOAK };

export interface DetailRecordNumber {
  id: number;
  number: string;
  fee: string;
  type: string;
  status: string;
}

export const STATUS_FEE = {
  ACTIVE: "Biểu phí đang có hiệu lực",
  INACTIVE: "Biểu phí không còn hiệu lực tại thời điểm hiện tại",
  PENDING: "Biểu phí đang chờ duyệt",
};

export const STATUS_WARE_NUMBER = {
  PROCESSING: "Chờ duyệt",
  SUCCESS: "Đã upload",
  REJECT: "Từ chối",
  ERROR: "Lỗi dữ liệu",
  WAITING:"Đang xử lý dữ liệu"
};

export const STATUS_WARE_COLOR = {
  PROCESSING: "text-pending-500",
  SUCCESS: "text-success-500",
  REJECT: "text-error-500",
  ERROR: "text-error-500",
};

export const STATUS_CONFIG_FEE = [
  {
    label: "Biểu phí đang có hiệu lực",
    value: "ACTIVE",
  },
  {
    label: "Biểu phí không còn hiệu lực tại thời điểm hiện tại",
    value: "INACTIVE",
  },
  {
    label: "Biểu phí đang chờ duyệt",
    value: "PENDING",
  },
];

export const STATUS_CUSTOMER = {
  PAYMENT_FAIL: "Thanh toán lỗi",
  OPEN_ACCOUNT_SUCCESS: "Mở tài khoản thành công",
  MISSING_SERVICE: "Lỗi dịch vụ",
  OPEN_ACCOUNT_FAIL: "Mở tài khoản thất bại",
  SELECT_NUMBER: "Đã chọn số",
};

export const STATUS_CUSTOMER_COLOR = {
  PAYMENT_FAIL: "text-error-500",
  OPEN_ACCOUNT_SUCCESS: "text-success-500",
  MISSING_SERVICE: "text-error-500",
  OPEN_ACCOUNT_FAIL: "text-error-500",
  SELECT_NUMBER: "text-pending-500",
};

export const STATUS_PROMOTION = {
  APPROVE: "Đã duyệt",

  REJECT: "Từ chối",

  EXPIRED: "Hết hạn",

  WAITING_APPROVE: "Chờ phê duyệt",

  PENDING_FOR_EDIT_APPROVAL: "Chờ phê duyệt chỉnh sửa",
};

export const STATUS_PROMOTION_COLOR = {
  APPROVE: "text-success-500",

  REJECT: "text-error-500",

  EXPIRED: "text-color-600",

  WAITING_APPROVE: "text-pending-500",

  PENDING_FOR_EDIT_APPROVAL: "text-link-500",
};

export const ROLE = {
  OPERATION_CREATE: "NHS/NUMBER_BEAUTIFUL/OPERATION_CREATE",
  OPERATION_APPROVE: "NHS/NUMBER_BEAUTIFUL/OPERATION_APPROVE",
  VIEW: "NHS/NUMBER_BEAUTIFUL/VIEW",
  STORAGE_CREATE: "NHS/NUMBER_BEAUTIFUL/STORAGE_CREATE",
  STORAGE_APPROVE: "NHS/NUMBER_BEAUTIFUL/STORAGE_APPROVE",
};

export const ROLEID = {
  3: "VIEW",
  4: "STORAGE_CREATE",
  5: "STORAGE_APPROVE",
  1: "OPERATION_CREATE",
  2: "OPERATION_APPROVE",
};

export const ROLENAME = {
  3: "Tài khoản xem",
  4: "Quản lý kho số - Khởi tạo",
  5: "Quản lý kho số - Phê duyệt",
  1: "Tài khoản vận hành – Khởi tạo",
  2: "Tài khoản vận hành – Phê duyệt",
};