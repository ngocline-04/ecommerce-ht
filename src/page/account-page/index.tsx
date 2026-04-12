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
import { updateProfile } from "firebase/auth";
import { auth } from "@/App";

type GenderType = "MALE" | "FEMALE" | "OTHER";

type PersonalProfileForm = {
  fullName: string;
  phoneNumber: string;
  dateOfBirth?: dayjs.Dayjs | null;
  gender: GenderType;
  address: string;
  province: string;
  district: string;
  ward: string;
  bio: string;
  avatar: string;
};

const PROFILE_STORAGE_KEY = "personal_profile_screen_data";

const DEFAULT_PROFILE: PersonalProfileForm = {
  fullName: "",
  phoneNumber: "",
  dateOfBirth: null,
  gender: "OTHER",
  address: "",
  province: "",
  district: "",
  ward: "",
  bio: "",
  avatar: "",
};

const GENDER_OPTIONS = [
  { label: "Nam", value: "MALE" },
  { label: "Nữ", value: "FEMALE" },
  { label: "Khác", value: "OTHER" },
];

const PROVINCE_OPTIONS = [
  { label: "Hà Nội", value: "HN" },
  { label: "TP. Hồ Chí Minh", value: "HCM" },
  { label: "Đà Nẵng", value: "DN" },
  { label: "Hải Phòng", value: "HP" },
  { label: "Cần Thơ", value: "CT" },
];

const DISTRICT_OPTIONS: Record<string, { label: string; value: string }[]> = {
  HN: [
    { label: "Ba Đình", value: "BADINH" },
    { label: "Cầu Giấy", value: "CAUGIAY" },
    { label: "Nam Từ Liêm", value: "NAMTULIEM" },
  ],
  HCM: [
    { label: "Quận 1", value: "Q1" },
    { label: "Quận 7", value: "Q7" },
    { label: "Thủ Đức", value: "THUDUC" },
  ],
  DN: [
    { label: "Hải Châu", value: "HAICHAU" },
    { label: "Thanh Khê", value: "THANHKHE" },
  ],
  HP: [
    { label: "Ngô Quyền", value: "NGOQUYEN" },
    { label: "Lê Chân", value: "LECHAN" },
  ],
  CT: [
    { label: "Ninh Kiều", value: "NINHKIEU" },
    { label: "Bình Thủy", value: "BINHTHUY" },
  ],
};

const WARD_OPTIONS: Record<string, { label: string; value: string }[]> = {
  BADINH: [
    { label: "Điện Biên", value: "DIENBIEN" },
    { label: "Kim Mã", value: "KIMMA" },
  ],
  CAUGIAY: [
    { label: "Dịch Vọng", value: "DICHVONG" },
    { label: "Nghĩa Đô", value: "NGHIADO" },
  ],
  NAMTULIEM: [
    { label: "Mỹ Đình 1", value: "MYDINH1" },
    { label: "Mỹ Đình 2", value: "MYDINH2" },
  ],
  Q1: [
    { label: "Bến Nghé", value: "BENGHE" },
    { label: "Bến Thành", value: "BENTHANH" },
  ],
  Q7: [
    { label: "Tân Phú", value: "TANPHU" },
    { label: "Tân Hưng", value: "TANHUNG" },
  ],
  THUDUC: [
    { label: "Hiệp Bình Chánh", value: "HIEPBINHCHANH" },
    { label: "Linh Tây", value: "LINHTAY" },
  ],
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
      address: parsed?.address || "",
      province: parsed?.province || "",
      district: parsed?.district || "",
      ward: parsed?.ward || "",
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarFileList, setAvatarFileList] = useState<UploadFile[]>([]);

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
      provider:
        currentUser?.providerData?.[0]?.providerId || "password",
    };
  }, [currentUser]);

  const province = Form.useWatch("province", form);
  const district = Form.useWatch("district", form);

  const districtOptions = useMemo(() => {
    return DISTRICT_OPTIONS[province || ""] || [];
  }, [province]);

  const wardOptions = useMemo(() => {
    return WARD_OPTIONS[district || ""] || [];
  }, [district]);

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
          address: localProfile.address || "",
          province: localProfile.province || "",
          district: localProfile.district || "",
          ward: localProfile.ward || "",
          bio: localProfile.bio || "",
          avatar: localProfile.avatar || authInfo.photoURL || "",
        });
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, [authInfo.displayName, authInfo.photoURL, form]);

  const handleProvinceChange = () => {
    form.setFieldsValue({
      district: "",
      ward: "",
    });
  };

  const handleDistrictChange = () => {
    form.setFieldsValue({
      ward: "",
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
          (values.fullName || "") !== (auth.currentUser.displayName || "") ||
          (values.avatar || "") !== (auth.currentUser.photoURL || "");

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

  if (!currentUser && !loading) {
    return (
      <div className="block-content">
        <Card className="rounded-radius-xl">
          <Empty description="Bạn cần đăng nhập để xem thông tin cá nhân" />
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
            Cập nhật hồ sơ cá nhân, ảnh đại diện và thông tin liên hệ của bạn
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
                {form.getFieldValue("fullName") || authInfo.displayName || "Người dùng"}
              </div>

              <div className="mt-4 text-14 text-color-700">
                {authInfo.email || "-"}
              </div>

              <div className="mt-12 flex flex-wrap justify-center gap-8">
                <Tag color="blue">{authInfo.provider}</Tag>
                <Tag color={authInfo.emailVerified ? "green" : "red"}>
                  {authInfo.emailVerified ? "Đã xác thực email" : "Chưa xác thực email"}
                </Tag>
              </div>

              <Divider />

              <Upload
                accept="image/*"
                showUploadList={false}
                beforeUpload={handleUploadAvatar}
              >
                <Button
                  icon={<CameraOutlined />}
                  loading={avatarUploading}
                >
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
                  <span className="font-medium text-color-900">Ngày tạo TK:</span>{" "}
                  {authInfo.createdAt
                    ? dayjs(authInfo.createdAt).format("DD/MM/YYYY HH:mm")
                    : "-"}
                </div>

                <div className="text-13 text-color-700">
                  <span className="font-medium text-color-900">Đăng nhập gần nhất:</span>{" "}
                  {authInfo.lastSignInAt
                    ? dayjs(authInfo.lastSignInAt).format("DD/MM/YYYY HH:mm")
                    : "-"}
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
                <Button icon={<LockOutlined />}>Đổi mật khẩu</Button>
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
                      { required: true, message: "Vui lòng nhập số điện thoại" },
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

                <Col xs={24} md={12}>
                  <Form.Item label="Tỉnh / Thành phố" name="province">
                    <Select
                      size="large"
                      options={PROVINCE_OPTIONS}
                      placeholder="Chọn tỉnh / thành phố"
                      onChange={handleProvinceChange}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item label="Quận / Huyện" name="district">
                    <Select
                      size="large"
                      options={districtOptions}
                      placeholder="Chọn quận / huyện"
                      onChange={handleDistrictChange}
                      disabled={!province}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item label="Phường / Xã" name="ward">
                    <Select
                      size="large"
                      options={wardOptions}
                      placeholder="Chọn phường / xã"
                      disabled={!district}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24}>
                  <Form.Item
                    label="Địa chỉ chi tiết"
                    name="address"
                    rules={[
                      { required: true, message: "Vui lòng nhập địa chỉ chi tiết" },
                    ]}
                  >
                    <Input
                      size="large"
                      placeholder="Số nhà, tên đường, tòa nhà..."
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
                          ? dayjs(authInfo.createdAt).format("DD/MM/YYYY HH:mm")
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
                          ? dayjs(authInfo.lastSignInAt).format("DD/MM/YYYY HH:mm")
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
    </div>
  );
};

const ProfilePage = memo(Component);

export default ProfilePage;