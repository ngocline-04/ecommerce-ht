import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY || "");

export async function sendOrderConfirmationEmail(params: {
  to: string;
  customerName: string;
  orderId: string;
  totalAmount: number;
  paymentType: string;
  paymentStatusText: string;
}) {
  const {
    to,
    customerName,
    orderId,
    totalAmount,
    paymentType,
    paymentStatusText,
  } = params;

  if (!process.env.RESEND_API_KEY) {
    throw new Error("Thiếu RESEND_API_KEY");
  }

  if (!process.env.EMAIL_FROM) {
    throw new Error("Thiếu EMAIL_FROM");
  }

  if (!to) {
    throw new Error("Thiếu email người nhận");
  }
  const isDev =
    String(process.env.DEV || "").trim().toLowerCase() === "true";

  const finalTo = isDev ? "kcgbathhub.shipping@gmail.com" : to;
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to: [finalTo],
    subject: `Xác nhận đơn hàng #${orderId}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222;">
        <h2>Xác nhận đơn hàng</h2>
        <p>Xin chào <b>${customerName || "Quý khách"}</b>,</p>
        <p>Đơn hàng của bạn đã được ghi nhận thành công.</p>
        <ul>
          <li><b>Mã đơn hàng:</b> ${orderId}</li>
          <li><b>Tổng tiền:</b> ${Number(totalAmount || 0).toLocaleString("vi-VN")} ₫</li>
          <li><b>Hình thức thanh toán:</b> ${paymentType}</li>
          <li><b>Trạng thái thanh toán:</b> ${paymentStatusText}</li>
        </ul>
        <p>Cảm ơn bạn đã mua hàng tại KCG BathHub.</p>
      </div>
    `,
  });

  if (error) {
    throw new Error(error.message || "Gửi email thất bại");
  }
}