import React, { memo, useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Button,
  Card,
  Col,
  DatePicker,
  Divider,
  Form,
  Input,
  Modal,
  Radio,
  Row,
  Select,
  Space,
  Spin,
  Tag,
  Upload,
  message,
} from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import {
  CameraOutlined,
  LockOutlined,
  MailOutlined,
  PhoneOutlined,
  SaveOutlined,
  UserOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  updatePassword,
  updateProfile,
} from "firebase/auth";
import { auth } from "@/App";
import addressData from "@/assets/json/address.json";

type GenderType = "MALE" | "FEMALE" | "OTHER";

type AddressMappingRow = {
  city_id_old?: number;
  city_name_old?: string;
  district_id_old?: number;
  district_name_old?: string;
  ward_id_old?: number;
  ward_name_old?: string;
  city_id_new: number;
  city_name_new: string;
  ward_id_new: number;
  ward_new_name: string;
};

type PersonalProfileForm = {
  fullName: string;
  phoneNumber: string;
  dateOfBirth?: dayjs.Dayjs | null;
  gender: GenderType;
  cityIdNew?: number;
  wardIdNew?: number;
  addressLine: string;
  bio: string;
  avatar: string;
};

type ChangePasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const PROFILE_STORAGE_KEY = "personal_profile_screen_data";

const DEFAULT_PROFILE: PersonalProfileForm = {
  fullName: "",
  phoneNumber: "",
  dateOfBirth: null,
  gender: "OTHER",
  cityIdNew: undefined,
  wardIdNew: undefined,
  addressLine: "",
  bio: "",
  avatar: "",
};

const GENDER_OPTIONS = [
  { label: "Nam", value: "MALE" },
  { label: "Nữ", value: "FEMALE" },
  { label: "Khác", value: "OTHER" },
];

const normalizeText = (value?: string) => String(value || "").trim();

const dedupeBy = <T,>(items: T[], keyGetter: (item: T) => string | number) => {
  const map = new Map<string | number, T>();
  items.forEach((item) => {
    const key = keyGetter(item);
    if (!map.has(key)) {
      map.set(key, item);
    }
  });
  return Array.from(map.values());
};

const readProfileFromStorage = (): PersonalProfileForm => {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;

    const parsed = JSON.parse(raw);

    return {
      fullName: parsed?.fullName || "",
      phoneNumber: parsed?.phoneNumber || "",
      dateOfBirth: parsed?.dateOfBirth ? dayjs(parsed.dateOfBirth) : null,
      gender: parsed?.gender || "OTHER",
      cityIdNew:
        typeof parsed?.cityIdNew === "number" ? parsed.cityIdNew : undefined,
      wardIdNew:
        typeof parsed?.wardIdNew === "number" ? parsed.wardIdNew : undefined,
      addressLine: parsed?.addressLine || "",
      bio: parsed?.bio || "",
      avatar: parsed?.avatar || "",
    };
  } catch {
    return DEFAULT_PROFILE;
  }
};

const writeProfileToStorage = (data: PersonalProfileForm) => {
  localStorage.setItem(
    PROFILE_STORAGE_KEY,
    JSON.stringify({
      ...data,
      dateOfBirth: data.dateOfBirth ? data.dateOfBirth.toISOString() : null,
    }),
  );
};

const getBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = (error) => reject(error);
  });

const Component = () => {
  const [form] = Form.useForm<PersonalProfileForm>();
  const [passwordForm] = Form.useForm<ChangePasswordForm>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarFileList, setAvatarFileList] = useState<UploadFile[]>([]);

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [sendingResetMail, setSendingResetMail] = useState(false);

  const currentUser = auth.currentUser;

  const authInfo = useMemo(() => {
    return {
      uid: currentUser?.uid || "",
      email: currentUser?.email || "",
      emailVerified: !!currentUser?.emailVerified,
      displayName: currentUser?.displayName || "",
      photoURL: currentUser?.photoURL || "",
      createdAt: currentUser?.metadata?.creationTime || "",
      lastSignInAt: currentUser?.metadata?.lastSignInTime || "",
      provider: currentUser?.providerData?.[0]?.providerId || "password",
    };
  }, [currentUser]);

  const addressRows = useMemo<AddressMappingRow[]>(() => {
    return (Array.isArray(addressData) ? addressData : []) as AddressMappingRow[];
  }, []);

  const cityOptions = useMemo(() => {
    const uniqueCities = dedupeBy(
      addressRows
        .filter((item) => item.city_id_new && normalizeText(item.city_name_new))
        .map((item) => ({
          value: item.city_id_new,
          label: normalizeText(item.city_name_new),
        })),
      (item) => item.value,
    );

    return uniqueCities.sort((a, b) => a.label.localeCompare(b.label, "vi"));
  }, [addressRows]);

  const selectedCityId = Form.useWatch("cityIdNew", form);

  const wardOptions = useMemo(() => {
    if (!selectedCityId) return [];

    const wards = dedupeBy(
      addressRows
        .filter((item) => Number(item.city_id_new) === Number(selectedCityId))
        .map((item) => ({
          value: item.ward_id_new,
          label: normalizeText(item.ward_new_name),
        }))
        .filter((item) => item.value && item.label),
      (item) => item.value,
    );

    return wards.sort((a, b) => a.label.localeCompare(b.label, "vi"));
  }, [addressRows, selectedCityId]);

  const selectedWardId = Form.useWatch("wardIdNew", form);

  const selectedCityLabel = useMemo(() => {
    return cityOptions.find((item) => item.value === selectedCityId)?.label || "";
  }, [cityOptions, selectedCityId]);

  const selectedWardLabel = useMemo(() => {
    return wardOptions.find((item) => item.value === selectedWardId)?.label || "";
  }, [selectedWardId, wardOptions]);

  const fullAddressPreview = useMemo(() => {
    const addressLine = normalizeText(form.getFieldValue("addressLine"));
    return [addressLine, selectedWardLabel, selectedCityLabel]
      .filter(Boolean)
      .join(", ");
  }, [form, selectedCityLabel, selectedWardLabel]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        setLoading(true);

        const localProfile = readProfileFromStorage();

        form.setFieldsValue({
          fullName: localProfile.fullName || authInfo.displayName || "",
          phoneNumber: localProfile.phoneNumber || "",
          dateOfBirth: localProfile.dateOfBirth || null,
          gender: localProfile.gender || "OTHER",
          cityIdNew: localProfile.cityIdNew,
          wardIdNew: localProfile.wardIdNew,
          addressLine: localProfile.addressLine || "",
          bio: localProfile.bio || "",
          avatar: localProfile.avatar || authInfo.photoURL || "",
        });

        if (localProfile.avatar || authInfo.photoURL) {
          const avatarUrl = localProfile.avatar || authInfo.photoURL || "";
          if (avatarUrl) {
            setAvatarFileList([
              {
                uid: "initial-avatar",
                name: "avatar",
                status: "done",
                url: avatarUrl,
              },
            ]);
          }
        }
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, [authInfo.displayName, authInfo.photoURL, form]);

  const handleCityChange = () => {
    form.setFieldsValue({
      wardIdNew: undefined,
    });
  };

  const handleUploadAvatar = async (file: File) => {
    try {
      setAvatarUploading(true);

      const base64 = await getBase64(file);

      form.setFieldValue("avatar", base64);
      setAvatarFileList([
        {
          uid: `${Date.now()}`,
          name: file.name,
          status: "done",
          url: base64,
        },
      ]);
    } catch (error) {
      console.error(error);
      message.error("Tải ảnh đại diện thất bại");
    } finally {
      setAvatarUploading(false);
    }

    return false;
  };

  const handleSave = async (values: PersonalProfileForm) => {
    try {
      setSaving(true);

      const profileToSave: PersonalProfileForm = {
        ...values,
      };

      writeProfileToStorage(profileToSave);

      if (auth.currentUser) {
        const shouldUpdateAuthProfile =
          normalizeText(values.fullName) !==
            normalizeText(auth.currentUser.displayName || "") ||
          normalizeText(values.avatar) !==
            normalizeText(auth.currentUser.photoURL || "");

        if (shouldUpdateAuthProfile) {
          await updateProfile(auth.currentUser, {
            displayName: values.fullName || "",
            photoURL: values.avatar || "",
          });
        }
      }

      message.success("Cập nhật thông tin cá nhân thành công");
    } catch (error) {
      console.error(error);
      message.error("Cập nhật thông tin cá nhân thất bại");
    } finally {
      setSaving(false);
    }
  };

  const openChangePasswordModal = () => {
    passwordForm.resetFields();
    setPasswordModalOpen(true);
  };

  const handleChangePassword = async (values: ChangePasswordForm) => {
    try {
      if (!auth.currentUser) {
        message.error("Bạn chưa đăng nhập");
        return;
      }

      if (!auth.currentUser.email) {
        message.error("Tài khoản hiện tại không có email để xác thực");
        return;
      }

      setChangingPassword(true);

      const credential = EmailAuthProvider.credential(
        auth.currentUser.email,
        values.currentPassword,
      );

      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, values.newPassword);

      message.success("Đổi mật khẩu thành công");
      passwordForm.resetFields();
      setPasswordModalOpen(false);
    } catch (error: any) {
      console.error(error);

      if (error?.code === "auth/wrong-password") {
        message.error("Mật khẩu hiện tại không đúng");
        return;
      }

      if (error?.code === "auth/weak-password") {
        message.error("Mật khẩu mới quá yếu");
        return;
      }

      if (error?.code === "auth/requires-recent-login") {
        message.error(
          "Phiên đăng nhập đã cũ. Vui lòng đăng nhập lại hoặc dùng gửi email đặt lại mật khẩu.",
        );
        return;
      }

      if (error?.code === "auth/too-many-requests") {
        message.error("Bạn thao tác quá nhiều lần. Vui lòng thử lại sau");
        return;
      }

      message.error("Đổi mật khẩu thất bại");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSendResetPasswordEmail = async () => {
    try {
      if (!auth.currentUser?.email) {
        message.error("Không tìm thấy email tài khoản");
        return;
      }

      setSendingResetMail(true);

      auth.languageCode = "vi";

      await sendPasswordResetEmail(auth, auth.currentUser.email, {
        url: `${window.location.origin}/login`,
        handleCodeInApp: false,
      });

      message.success(
        "Đã gửi email đặt lại mật khẩu. Vui lòng kiểm tra hộp thư và cả mục Spam/Junk.",
      );
    } catch (error: any) {
      console.error(error);

      if (error?.code === "auth/too-many-requests") {
        message.error("Bạn thao tác quá nhiều lần. Vui lòng thử lại sau");
        return;
      }

      message.error("Gửi email đặt lại mật khẩu thất bại");
    } finally {
      setSendingResetMail(false);
    }
  };

  if (!currentUser && !loading) {
    return (
      <div className="block-content">
        <Card className="rounded-radius-xl">
          <div className="flex min-h-[320px] items-center justify-center">
            <div className="text-center">
              <div className="mb-8 text-18 font-semibold">
                Bạn chưa đăng nhập
              </div>
              <div className="text-14 text-color-700">
                Vui lòng đăng nhập để xem và cập nhật thông tin cá nhân
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="block-content">
        <Card className="rounded-radius-xl">
          <div className="flex min-h-[320px] items-center justify-center">
            <Spin size="large" />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="block-content">
      <div className="mb-16 rounded-radius-xxl bg-gradient-to-r from-primary-500 to-link-600 p-24 text-common-1000">
        <div className="flex flex-col gap-8">
          <div className="text-28 font-semibold leading-36">
            Quản lý thông tin cá nhân
          </div>
          <div className="text-14 leading-22 text-common-1000/90">
            Cập nhật hồ sơ cá nhân, ảnh đại diện và địa chỉ liên hệ của bạn
          </div>
        </div>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={8}>
          <Card className="rounded-radius-xl">
            <div className="flex flex-col items-center">
              <Avatar
                size={120}
                src={form.getFieldValue("avatar")}
                icon={<UserOutlined />}
              />

              <div className="mt-16 text-20 font-semibold text-color-900">
                {form.getFieldValue("fullName") ||
                  authInfo.displayName ||
                  "Người dùng"}
              </div>

              <div className="mt-4 text-14 text-color-700">
                {authInfo.email || "-"}
              </div>

              <div className="mt-12 flex flex-wrap justify-center gap-8">
                <Tag color="blue">{authInfo.provider}</Tag>
                <Tag color={authInfo.emailVerified ? "green" : "red"}>
                  {authInfo.emailVerified
                    ? "Đã xác thực email"
                    : "Chưa xác thực email"}
                </Tag>
              </div>

              <Divider />

              <Upload
                accept="image/*"
                showUploadList={false}
                beforeUpload={handleUploadAvatar}
              >
                <Button icon={<CameraOutlined />} loading={avatarUploading}>
                  Đổi ảnh đại diện
                </Button>
              </Upload>

              <div className="mt-16 w-full rounded-radius-l bg-color-100 p-16">
                <div className="mb-8 text-13 font-medium text-color-900">
                  Thông tin chỉ xem
                </div>

                <div className="mb-8 text-13 text-color-700">
                  <span className="font-medium text-color-900">UID:</span>{" "}
                  {authInfo.uid || "-"}
                </div>

                <div className="mb-8 text-13 text-color-700">
                  <span className="font-medium text-color-900">
                    Ngày tạo TK:
                  </span>{" "}
                  {authInfo.createdAt
                    ? dayjs(authInfo.createdAt).format("DD/MM/YYYY HH:mm")
                    : "-"}
                </div>

                <div className="text-13 text-color-700">
                  <span className="font-medium text-color-900">
                    Đăng nhập gần nhất:
                  </span>{" "}
                  {authInfo.lastSignInAt
                    ? dayjs(authInfo.lastSignInAt).format("DD/MM/YYYY HH:mm")
                    : "-"}
                </div>
              </div>

              <div className="mt-16 w-full rounded-radius-l bg-color-100 p-16">
                <div className="mb-8 text-13 font-medium text-color-900">
                  Xem nhanh địa chỉ
                </div>
                <div className="text-13 leading-20 text-color-700">
                  {fullAddressPreview || "Chưa cập nhật địa chỉ"}
                </div>
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} xl={16}>
          <Card
            className="rounded-radius-xl"
            title="Thông tin hồ sơ"
            extra={
              <Space>
                <Button icon={<LockOutlined />} onClick={openChangePasswordModal}>
                  Đổi mật khẩu
                </Button>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  loading={saving}
                  onClick={() => form.submit()}
                >
                  Lưu thay đổi
                </Button>
              </Space>
            }
          >
            <Form<PersonalProfileForm>
              form={form}
              layout="vertical"
              autoComplete="off"
              onFinish={handleSave}
              initialValues={DEFAULT_PROFILE}
            >
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="Họ và tên"
                    name="fullName"
                    rules={[
                      { required: true, message: "Vui lòng nhập họ và tên" },
                      { min: 2, message: "Họ và tên tối thiểu 2 ký tự" },
                    ]}
                  >
                    <Input
                      size="large"
                      prefix={<UserOutlined />}
                      placeholder="Nhập họ và tên"
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item label="Email đăng nhập">
                    <Input
                      size="large"
                      prefix={<MailOutlined />}
                      value={authInfo.email}
                      disabled
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item
                    label="Số điện thoại"
                    name="phoneNumber"
                    rules={[
                      {
                        required: true,
                        message: "Vui lòng nhập số điện thoại",
                      },
                      {
                        pattern: /^(0|\+84)\d{8,10}$/,
                        message: "Số điện thoại không đúng định dạng",
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      prefix={<PhoneOutlined />}
                      placeholder="Nhập số điện thoại"
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item label="Ngày sinh" name="dateOfBirth">
                    <DatePicker
                      size="large"
                      className="w-full"
                      format="DD/MM/YYYY"
                      placeholder="Chọn ngày sinh"
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item label="Giới tính" name="gender">
                    <Radio.Group options={GENDER_OPTIONS} />
                  </Form.Item>
                </Col>

                <Col xs={24}>
                  <Divider orientation="left">Địa chỉ liên hệ</Divider>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item
                    label="Tỉnh / Thành phố"
                    name="cityIdNew"
                    rules={[
                      {
                        required: true,
                        message: "Vui lòng chọn tỉnh / thành phố",
                      },
                    ]}
                  >
                    <Select
                      size="large"
                      options={cityOptions}
                      placeholder="Chọn tỉnh / thành phố"
                      onChange={handleCityChange}
                      showSearch
                      optionFilterProp="label"
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item
                    label="Phường / Xã"
                    name="wardIdNew"
                    rules={[
                      {
                        required: true,
                        message: "Vui lòng chọn phường / xã",
                      },
                    ]}
                  >
                    <Select
                      size="large"
                      options={wardOptions}
                      placeholder="Chọn phường / xã"
                      disabled={!selectedCityId}
                      showSearch
                      optionFilterProp="label"
                    />
                  </Form.Item>
                </Col>

                <Col xs={24}>
                  <Form.Item
                    label="Số nhà / Tên đường / Tòa nhà"
                    name="addressLine"
                    rules={[
                      {
                        required: true,
                        message: "Vui lòng nhập địa chỉ chi tiết",
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      placeholder="Ví dụ: Số 12, ngõ 8, đường Láng"
                    />
                  </Form.Item>
                </Col>

                <Col xs={24}>
                  <Form.Item label="Giới thiệu bản thân" name="bio">
                    <Input.TextArea
                      rows={4}
                      maxLength={500}
                      showCount
                      placeholder="Nhập vài dòng giới thiệu về bạn"
                    />
                  </Form.Item>
                </Col>

                <Col xs={24}>
                  <Divider orientation="left">Thông tin hệ thống</Divider>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item label="UID tài khoản">
                    <Input size="large" value={authInfo.uid} disabled />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item label="Trạng thái email">
                    <Input
                      size="large"
                      value={
                        authInfo.emailVerified
                          ? "Đã xác thực"
                          : "Chưa xác thực"
                      }
                      disabled
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item label="Ngày tạo tài khoản">
                    <Input
                      size="large"
                      value={
                        authInfo.createdAt
                          ? dayjs(authInfo.createdAt).format(
                              "DD/MM/YYYY HH:mm",
                            )
                          : ""
                      }
                      disabled
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item label="Đăng nhập gần nhất">
                    <Input
                      size="large"
                      value={
                        authInfo.lastSignInAt
                          ? dayjs(authInfo.lastSignInAt).format(
                              "DD/MM/YYYY HH:mm",
                            )
                          : ""
                      }
                      disabled
                    />
                  </Form.Item>
                </Col>

                <Col xs={24}>
                  <Form.Item name="avatar" hidden>
                    <Input />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Card>
        </Col>
      </Row>

      <Modal
        title="Đổi mật khẩu"
        open={passwordModalOpen}
        onCancel={() => setPasswordModalOpen(false)}
        footer={null}
        destroyOnClose
        width={560}
      >
        <div className="mb-16 rounded-radius-l bg-color-100 p-16">
          <div className="mb-4 text-14 font-medium text-color-900">
            Email tài khoản
          </div>
          <div className="text-14 text-color-700">
            {authInfo.email || "Không có email"}
          </div>
        </div>

        <Form<ChangePasswordForm>
          form={passwordForm}
          layout="vertical"
          autoComplete="off"
          onFinish={handleChangePassword}
        >
          <Form.Item
            label="Mật khẩu hiện tại"
            name="currentPassword"
            rules={[
              { required: true, message: "Vui lòng nhập mật khẩu hiện tại" },
            ]}
          >
            <Input.Password
              size="large"
              placeholder="Nhập mật khẩu hiện tại"
            />
          </Form.Item>

          <Form.Item
            label="Mật khẩu mới"
            name="newPassword"
            rules={[
              { required: true, message: "Vui lòng nhập mật khẩu mới" },
              { min: 6, message: "Mật khẩu mới tối thiểu 6 ký tự" },
            ]}
          >
            <Input.Password
              size="large"
              placeholder="Nhập mật khẩu mới"
            />
          </Form.Item>

          <Form.Item
            label="Xác nhận mật khẩu mới"
            name="confirmPassword"
            dependencies={["newPassword"]}
            rules={[
              { required: true, message: "Vui lòng xác nhận mật khẩu mới" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("newPassword") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(
                    new Error("Mật khẩu xác nhận không khớp"),
                  );
                },
              }),
            ]}
          >
            <Input.Password
              size="large"
              placeholder="Nhập lại mật khẩu mới"
            />
          </Form.Item>

          <div className="mb-16 rounded-radius-l border border-color-300 p-16">
            <div className="mb-8 text-14 font-medium text-color-900">
              Xác nhận qua mail
            </div>
            <div className="mb-12 text-13 leading-20 text-color-700">
              Nếu bạn không muốn đổi trực tiếp, có thể gửi email đặt lại mật
              khẩu qua Firebase.
            </div>

            <Button
              block
              icon={<MailOutlined />}
              loading={sendingResetMail}
              onClick={handleSendResetPasswordEmail}
            >
              Gửi email đặt lại mật khẩu
            </Button>
          </div>

          <div className="flex justify-end gap-12">
            <Button onClick={() => setPasswordModalOpen(false)}>Đóng</Button>
            <Button
              type="primary"
              htmlType="submit"
              icon={<LockOutlined />}
              loading={changingPassword}
            >
              Cập nhật mật khẩu
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

const ProfilePage = memo(Component);

export default ProfilePage;