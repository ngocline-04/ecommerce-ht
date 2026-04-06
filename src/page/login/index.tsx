import { Button, Form, Input, Modal, Tabs } from "antd";
import {
  CloudSyncOutlined,
  SafetyOutlined,
  WindowsOutlined,
} from "@ant-design/icons";
import {
  createUserWithEmailAndPassword,
  getAuth,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { get } from "lodash";
import { useCallback, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { showDialog } from "@/components/dialog";
import { hideLoading, showLoading } from "../loading";
import { setUserInfo } from "@/store/login";
import { db } from "../../../firebase";
import ReactSvg from "@/assets/logo/logo-ht.png";

type LoginFormValues = {
  username: string;
  password: string;
};

type RegisterFormValues = {
  fullName: string;
  phoneNumber: string;
  email: string;
  password: string;
  confirmPassword: string;
};

type ForgotPasswordFormValues = {
  email: string;
};

const normalizePhone = (value?: string) =>
  String(value || "")
    .replace(/\s+/g, "")
    .replace(/[^\d+]/g, "")
    .trim();

const createCustomerId = () => `CUS${Date.now()}`;

export default function LoginPage() {
  const auth = getAuth();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [loginForm] = Form.useForm<LoginFormValues>();
  const [registerForm] = Form.useForm<RegisterFormValues>();
  const [forgotPasswordForm] = Form.useForm<ForgotPasswordFormValues>();

  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);

  const tabItems = useMemo(
    () => [
      { key: "login", label: "Đăng nhập" },
      { key: "register", label: "Đăng ký" },
    ],
    [],
  );

  const getAuthErrorMessage = useCallback((errorCode: string) => {
    switch (errorCode) {
      case "auth/invalid-credential":
        return "Tài khoản hoặc mật khẩu không đúng. Vui lòng kiểm tra lại!";
      case "auth/invalid-email":
        return "Email không đúng định dạng.";
      case "auth/user-not-found":
        return "Người dùng không tồn tại.";
      case "auth/wrong-password":
        return "Mật khẩu không đúng.";
      case "auth/email-already-in-use":
        return "Email này đã được đăng ký.";
      case "auth/weak-password":
        return "Mật khẩu quá yếu. Vui lòng chọn mật khẩu mạnh hơn.";
      case "auth/too-many-requests":
        return "Bạn thao tác quá nhiều lần. Vui lòng thử lại sau.";
      default:
        return "Đã có lỗi xảy ra. Vui lòng thử lại sau!";
    }
  }, []);

  const showErrorDialog = useCallback((content: string) => {
    showDialog({
      title: "Lỗi hệ thống",
      image: {
        name: "IC_AUTHEN_ERROR",
        width: 80,
        height: 80,
        fill: "text-error-500",
      },
      content,
      actions: [
        {
          title: "Thử lại",
          type: "secondary",
        },
      ],
    });
  }, []);

  const showSuccessDialog = useCallback((title: string, content: string) => {
    showDialog({
      title,
      image: {
        name: "IC_SUCCESS",
        width: 80,
        height: 80,
        fill: "text-success-500",
      },
      content,
      actions: [
        {
          title: "Đã hiểu",
          type: "primary",
        },
      ],
    });
  }, []);

  const onLogin = useCallback(
    async (data: LoginFormValues) => {
      const email = get(data, "username", "").trim();
      const password = get(data, "password", "");

      try {
        showLoading();

        const userCredential = await signInWithEmailAndPassword(
          auth,
          email,
          password,
        );
        const { user } = userCredential;

        if (!user.emailVerified) {
          showErrorDialog(
            "Email của bạn chưa được xác thực. Vui lòng kiểm tra hộp thư và bấm vào liên kết xác thực trước khi đăng nhập.",
          );
          return;
        }

        dispatch(
          setUserInfo({
            email: user?.email,
            uid: user?.uid,
            name: user?.displayName,
          }),
        );

        navigate("/");
      } catch (error: any) {
        showErrorDialog(getAuthErrorMessage(error?.code));
      } finally {
        hideLoading();
      }
    },
    [auth, dispatch, getAuthErrorMessage, navigate, showErrorDialog],
  );

  const onRegister = useCallback(
    async (values: RegisterFormValues) => {
      const fullName = String(values.fullName || "").trim();
      const phoneNumber = normalizePhone(values.phoneNumber);
      const email = String(values.email || "").trim().toLowerCase();
      const password = String(values.password || "");

      try {
        showLoading();

        const registerResult = await createUserWithEmailAndPassword(
          auth,
          email,
          password,
        );

        if (registerResult.user) {
          await updateProfile(registerResult.user, {
            displayName: fullName,
          });

          await sendEmailVerification(registerResult.user, {
            url: `${window.location.origin}/login`,
            handleCodeInApp: false,
          });
        }

        const usersRef = collection(db, "Users");

        const [existingByEmailSnapshot, existingByPhoneSnapshot] =
          await Promise.all([
            getDocs(
              query(usersRef, where("email", "==", email), limit(1)),
            ),
            getDocs(
              query(usersRef, where("phoneNumber", "==", phoneNumber), limit(1)),
            ),
          ]);

        const existingByEmailDoc = existingByEmailSnapshot.docs[0] || null;
        const existingByPhoneDoc = existingByPhoneSnapshot.docs[0] || null;

        if (existingByEmailDoc) {
          await updateDoc(doc(db, "Users", existingByEmailDoc.id), {
            name: fullName,
            phoneNumber,
            email,
            status: "ACTIVE",
            isStaff: false,
            updatedAt: serverTimestamp(),
          });
        } else if (existingByPhoneDoc) {
          await updateDoc(doc(db, "Users", existingByPhoneDoc.id), {
            name: fullName,
            phoneNumber,
            email,
            status: "ACTIVE",
            isStaff: false,
            updatedAt: serverTimestamp(),
          });
        } else {
          const customerId = createCustomerId();

          await setDoc(doc(db, "Users", customerId), {
            id: customerId,
            authUid: registerResult.user.uid,
            name: fullName,
            phoneNumber,
            email,
            address: "",
            dateOfBirth: "",
            branchCode: "",
            saleOwnerId: "",
            saleOwnerName: "",
            note: "",
            level: "BTC",
            status: "ACTIVE",
            isStaff: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        showSuccessDialog(
          "Đăng ký thành công",
          "Tài khoản đã được tạo thành công. Email xác thực đã được gửi tới hộp thư của bạn. Vui lòng kiểm tra cả Spam/Junk nếu chưa thấy.",
        );

        registerForm.resetFields();
        loginForm.setFieldsValue({
          username: email,
          password: "",
        });
        setActiveTab("login");
      } catch (error: any) {
        showErrorDialog(getAuthErrorMessage(error?.code));
      } finally {
        hideLoading();
      }
    },
    [
      auth,
      getAuthErrorMessage,
      loginForm,
      registerForm,
      showErrorDialog,
      showSuccessDialog,
    ],
  );

  const onForgotPassword = useCallback(
    async (values: ForgotPasswordFormValues) => {
      const email = String(values.email || "").trim().toLowerCase();

      try {
        showLoading();
        await sendPasswordResetEmail(auth, email);

        setForgotPasswordOpen(false);
        forgotPasswordForm.resetFields();

        showSuccessDialog(
          "Gửi email thành công",
          "Liên kết đặt lại mật khẩu đã được gửi tới email của bạn. Vui lòng kiểm tra cả hộp thư spam nếu chưa thấy.",
        );
      } catch (error: any) {
        showErrorDialog(getAuthErrorMessage(error?.code));
      } finally {
        hideLoading();
      }
    },
    [
      auth,
      forgotPasswordForm,
      getAuthErrorMessage,
      showErrorDialog,
      showSuccessDialog,
    ],
  );

  return (
    <div className="min-h-screen bg-color-200 px-24 py-24 mobile:px-16 mobile:py-16">
      <div className="mx-auto flex min-h-[calc(100vh-48px)] max-w-[1280px] items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-radius-xxxl bg-color-50 shadow-down-l shadow-color-300 tablet:grid-cols-1 [grid-template-columns:1.1fr_0.9fr]">
          <div className="flex min-h-[720px] flex-col justify-between bg-gradient-to-br from-primary-500 via-link-500 to-link-700 p-40 text-common-1000 tablet:hidden">
            <div>
              <div className="flex items-center">
                <img
                  src={ReactSvg}
                  alt=""
                  style={{
                    width: "30px",
                    height: "30px",
                  }}
                />
                <div className="inline-flex rounded-radius-full bg-common-1000/10 px-16 py-8 text-12 font-semibold leading-16">
                  CÔNG TY TNHH QUỐC TẾ HOÀNG TRƯỜNG
                </div>
              </div>

              <div className="mt-24 text-40 font-bold leading-52">
                Chào mừng đến với hệ thống bán hàng
              </div>

              <div className="mt-16 max-w-[500px] text-16 leading-28 text-common-1000/80">
                Đăng nhập để tiếp tục mua sắm, quản lý đơn hàng và sử dụng các
                tiện ích dành riêng cho tài khoản của bạn.
              </div>
            </div>

            <div className="grid gap-16">
              <div className="rounded-radius-xxl bg-common-1000/10 p-20 flex items-start">
                <SafetyOutlined />
                <div className="ml-16">
                  <div className="mb-8 text-18 font-semibold leading-24">
                    Đăng nhập nhanh chóng
                  </div>
                  <div className="text-14 leading-24 text-common-1000/80">
                    Sử dụng email và mật khẩu để truy cập tài khoản một cách an
                    toàn.
                  </div>
                </div>
              </div>

              <div className="rounded-radius-xxl bg-common-1000/10 p-20 flex items-start">
                <WindowsOutlined />
                <div className="ml-16">
                  <div className="mb-8 text-18 font-semibold leading-24">
                    Đăng ký thông minh
                  </div>
                  <div className="text-14 leading-24 text-common-1000/80">
                    Nếu số điện thoại đã có trong hệ thống khách hàng, hệ thống
                    sẽ cập nhật hồ sơ cũ thay vì bỏ qua tài khoản mới.
                  </div>
                </div>
              </div>

              <div className="rounded-radius-xxl bg-common-1000/10 p-20 flex items-start">
                <CloudSyncOutlined />
                <div className="ml-16">
                  <div className="mb-8 text-18 font-semibold leading-24">
                    Khôi phục mật khẩu dễ dàng
                  </div>
                  <div className="text-14 leading-24 text-common-1000/80">
                    Bạn có thể yêu cầu email đặt lại mật khẩu ngay tại màn hình
                    đăng nhập.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex min-h-[720px] items-center justify-center bg-color-50 p-40 tablet:min-h-[unset] tablet:p-32 mobile:p-20">
            <div className="w-full max-w-[460px]">
              <div className="mb-28 text-center">
                <div className="text-32 font-bold leading-40 text-color-900 mobile:text-28 mobile:leading-36">
                  Xin chào
                </div>
                <div className="mt-8 text-14 leading-20 text-color-700">
                  Đăng nhập hoặc tạo tài khoản để tiếp tục
                </div>
              </div>

              <div className="rounded-radius-xxl border border-color-300 bg-color-50 p-24 shadow-down-s shadow-color-300 mobile:p-16">
                <Tabs
                  activeKey={activeTab}
                  onChange={(key) => setActiveTab(key as "login" | "register")}
                  items={tabItems}
                  centered
                />

                {activeTab === "login" ? (
                  <Form<LoginFormValues>
                    form={loginForm}
                    name="login"
                    onFinish={onLogin}
                    layout="vertical"
                    className="mt-16"
                    autoComplete="off"
                  >
                    <Form.Item
                      name="username"
                      label="Email"
                      rules={[
                        { required: true, message: "Vui lòng nhập email!" },
                        {
                          type: "email",
                          message: "Email không đúng định dạng!",
                        },
                      ]}
                    >
                      <Input
                        size="large"
                        placeholder="Nhập email"
                        className="rounded-radius-s px-12 text-14 leading-20"
                      />
                    </Form.Item>

                    <Form.Item
                      name="password"
                      label="Mật khẩu"
                      rules={[
                        { required: true, message: "Vui lòng nhập mật khẩu!" },
                      ]}
                    >
                      <Input.Password
                        size="large"
                        placeholder="Nhập mật khẩu"
                        className="rounded-radius-s px-12 text-14 leading-20"
                      />
                    </Form.Item>

                    <div className="mb-20 mt-4 text-right">
                      <button
                        type="button"
                        className="text-14 font-medium leading-20 text-link-500 hover:underline"
                        onClick={() => {
                          setForgotPasswordOpen(true);
                          forgotPasswordForm.setFieldsValue({
                            email: loginForm.getFieldValue("username") || "",
                          });
                        }}
                      >
                        Quên mật khẩu?
                      </button>
                    </div>

                    <Form.Item className="mb-0">
                      <Button
                        type="primary"
                        htmlType="submit"
                        className="h-46 w-full rounded-radius-l bg-primary-500 text-14 font-semibold leading-20 text-common-1000 hover:opacity-xl"
                      >
                        Đăng nhập
                      </Button>
                    </Form.Item>
                  </Form>
                ) : (
                  <Form<RegisterFormValues>
                    form={registerForm}
                    name="register"
                    onFinish={onRegister}
                    layout="vertical"
                    className="mt-16"
                    autoComplete="off"
                  >
                    <Form.Item
                      name="fullName"
                      label="Họ và tên"
                      rules={[
                        { required: true, message: "Vui lòng nhập họ và tên!" },
                        { min: 2, message: "Họ và tên tối thiểu 2 ký tự!" },
                        { max: 120, message: "Họ và tên tối đa 120 ký tự!" },
                      ]}
                    >
                      <Input
                        size="large"
                        placeholder="Nhập họ và tên"
                        className="rounded-radius-s px-12 text-14 leading-20"
                      />
                    </Form.Item>

                    <Form.Item
                      name="phoneNumber"
                      label="Số điện thoại"
                      rules={[
                        {
                          required: true,
                          message: "Vui lòng nhập số điện thoại!",
                        },
                        {
                          validator: (_, value) => {
                            const normalized = normalizePhone(value);

                            if (!normalized) {
                              return Promise.reject(
                                new Error("Vui lòng nhập số điện thoại!"),
                              );
                            }

                            if (!/^(0|\+84)\d{8,10}$/.test(normalized)) {
                              return Promise.reject(
                                new Error(
                                  "Số điện thoại không đúng định dạng!",
                                ),
                              );
                            }

                            return Promise.resolve();
                          },
                        },
                      ]}
                    >
                      <Input
                        size="large"
                        placeholder="Nhập số điện thoại"
                        className="rounded-radius-s px-12 text-14 leading-20"
                      />
                    </Form.Item>

                    <Form.Item
                      name="email"
                      label="Email"
                      rules={[
                        { required: true, message: "Vui lòng nhập email!" },
                        {
                          type: "email",
                          message: "Email không đúng định dạng!",
                        },
                      ]}
                    >
                      <Input
                        size="large"
                        placeholder="Nhập email"
                        className="rounded-radius-s px-12 text-14 leading-20"
                      />
                    </Form.Item>

                    <Form.Item
                      name="password"
                      label="Mật khẩu"
                      rules={[
                        { required: true, message: "Vui lòng nhập mật khẩu!" },
                        { min: 6, message: "Mật khẩu tối thiểu 6 ký tự!" },
                      ]}
                    >
                      <Input.Password
                        size="large"
                        placeholder="Nhập mật khẩu"
                        className="rounded-radius-s px-12 text-14 leading-20"
                      />
                    </Form.Item>

                    <Form.Item
                      name="confirmPassword"
                      label="Xác nhận mật khẩu"
                      dependencies={["password"]}
                      rules={[
                        {
                          required: true,
                          message: "Vui lòng xác nhận mật khẩu!",
                        },
                        ({ getFieldValue }) => ({
                          validator(_, value) {
                            if (!value || getFieldValue("password") === value) {
                              return Promise.resolve();
                            }

                            return Promise.reject(
                              new Error("Mật khẩu xác nhận không khớp!"),
                            );
                          },
                        }),
                      ]}
                    >
                      <Input.Password
                        size="large"
                        placeholder="Nhập lại mật khẩu"
                        className="rounded-radius-s px-12 text-14 leading-20"
                      />
                    </Form.Item>

                    <Form.Item className="mb-0 mt-24">
                      <Button
                        type="primary"
                        htmlType="submit"
                        className="h-46 w-full rounded-radius-l bg-primary-500 text-14 font-semibold leading-20 text-common-1000 hover:opacity-xl"
                      >
                        Đăng ký
                      </Button>
                    </Form.Item>

                    <div className="mt-12 text-center text-13 leading-20 text-color-700">
                      Sau khi đăng ký thành công, hệ thống sẽ chuyển bạn sang
                      tab đăng nhập.
                    </div>
                  </Form>
                )}
              </div>

              <div className="mt-20 hidden text-center text-13 leading-20 text-color-700 tablet:block">
                Sử dụng email để đăng nhập và quản lý tài khoản của bạn trên mọi
                thiết bị.
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={forgotPasswordOpen}
        title="Quên mật khẩu"
        onCancel={() => setForgotPasswordOpen(false)}
        footer={null}
        width={460}
        destroyOnClose
      >
        <div className="mb-16 text-14 leading-20 text-color-700">
          Nhập email đã đăng ký để nhận liên kết đặt lại mật khẩu.
        </div>

        <Form<ForgotPasswordFormValues>
          form={forgotPasswordForm}
          layout="vertical"
          autoComplete="off"
          onFinish={onForgotPassword}
        >
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: "Vui lòng nhập email!" },
              { type: "email", message: "Email không đúng định dạng!" },
            ]}
          >
            <Input
              size="large"
              placeholder="Nhập email"
              className="rounded-radius-s px-12 text-14 leading-20"
            />
          </Form.Item>

          <div className="mt-20 flex justify-end gap-12">
            <Button
              className="h-44 rounded-radius-l"
              onClick={() => setForgotPasswordOpen(false)}
            >
              Huỷ
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              className="h-44 rounded-radius-l bg-primary-500 text-common-1000"
            >
              Gửi email
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}