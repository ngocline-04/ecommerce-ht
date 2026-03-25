import * as React from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Layout,
  theme as antTheme,
  Menu,
  Button,
  Badge,
  Avatar,
} from "antd";
import ReactSvg from "@/assets/logo/logo-ht.png";
import { useEffect, useMemo, useState } from "react";
import {
  BellOutlined,
  HomeOutlined,
  LoginOutlined,
  PoweroffOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/App";
import { CartBadge } from "@/baseComponent/cartBadge";
import ChatWidget from "@/components/chat";
import type { UserRecord } from "@/components/chat/chat.type";

const { Sider, Content, Header } = Layout;

type CategoryOption = {
  id: string;
  name: string;
  value?: string;
  categories?:
    | Array<{
        id?: string;
        name?: string;
      }>
    | string;
  data?: string;
};

type MenuCategoryItem = {
  key: string;
  label: string;
  path?: string;
  children?: MenuCategoryItem[];
};

function LayoutSaving() {
  const tokenAntd = antTheme.useToken();
  const location = useLocation();
  const navigate = useNavigate();
  const auth = getAuth();

  const [categories, setCategories] = useState<MenuCategoryItem[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentUserProfile, setCurrentUserProfile] =
    useState<UserRecord | null>(null);
  const [openKeys, setOpenKeys] = useState<string[]>([]);

  const selectedMenuKey = useMemo(() => {
    if (location.pathname === "/" && location.search) {
      return `${location.pathname}${location.search}`;
    }
    return location.pathname;
  }, [location.pathname, location.search]);

  const normalizeCategoryMenu = (
    rawData: CategoryOption[],
  ): MenuCategoryItem[] => {
    const result: MenuCategoryItem[] = [];

    rawData.forEach((item) => {
      if (Array.isArray(item.categories) && item.categories.length > 0) {
        const children = item.categories
          .filter((child) => child?.id && child?.name)
          .map((child) => ({
            key: `/?category=${child!.id}`,
            label: child!.name || "",
            path: `/?category=${child!.id}`,
          }));

        result.push({
          key: `category-parent-${item.id}`,
          label: item.name,
          children,
        });

        return;
      }

      if (typeof item.data === "string" && item.name) {
        result.push({
          key: `/?category=${item.data}`,
          label: item.name,
          path: `/?category=${item.data}`,
        });
        return;
      }

      if (item.id && item.name) {
        result.push({
          key: `/?category=${item.id}`,
          label: item.name,
          path: `/?category=${item.id}`,
        });
      }
    });

    return result;
  };

  const fetchCategories = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "Category"));

      const rawData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as CategoryOption[];

      const normalizedMenu = normalizeCategoryMenu(rawData);
      setCategories(normalizedMenu);
    } catch (error) {
      console.error("Lỗi lấy category:", error);
    }
  };

  const fetchCurrentUserProfile = async (email?: string | null) => {
    if (!email) {
      setCurrentUserProfile(null);
      return;
    }

    try {
      const q = query(
        collection(db, "Users"),
        where("email", "==", email),
        where("isStaff", "==", false),
      );

      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const userDoc = snapshot.docs[0];
        setCurrentUserProfile({
          id: userDoc.id,
          ...userDoc.data(),
        } as UserRecord);
        return;
      }

      const qStaff = query(
        collection(db, "Users"),
        where("email", "==", email),
        where("isStaff", "==", true),
      );

      const staffSnapshot = await getDocs(qStaff);

      if (!staffSnapshot.empty) {
        const staffDoc = staffSnapshot.docs[0];
        setCurrentUserProfile({
          id: staffDoc.id,
          ...staffDoc.data(),
        } as UserRecord);
        return;
      }

      setCurrentUserProfile(null);
    } catch (error) {
      console.error("Lỗi lấy thông tin user:", error);
      setCurrentUserProfile(null);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (user?.email) {
        await fetchCurrentUserProfile(user.email);
      } else {
        setCurrentUserProfile(null);
      }
    });

    return () => unsubscribe();
  }, [auth]);

  useEffect(() => {
    const matchedParent = categories.find((item) =>
      item.children?.some((child) => child.key === selectedMenuKey),
    );

    if (matchedParent) {
      setOpenKeys([matchedParent.key]);
    } else if (selectedMenuKey === "/") {
      setOpenKeys([]);
    }
  }, [categories, selectedMenuKey]);

  const menuItems: any[] = useMemo(() => {
    return [
      {
        key: "/",
        icon: <HomeOutlined />,
        label: "Trang chủ",
      },
      ...categories.map((item) => {
        if (item.children?.length) {
          return {
            key: item.key,
            label: item.label,
            children: item.children.map((child) => ({
              key: child.key,
              label: child.label,
            })),
          };
        }

        return {
          key: item.key,
          label: item.label,
        };
      }),
    ];
  }, [categories]);

  const onMenuClick = (path: string) => {
    navigate(path);
  };

  const handleGoToCart = () => {
    if (!currentUser) {
      navigate("/login");
      return;
    }

    navigate("/cart");
  };

  const handleGoToNotifications = () => {
    if (!currentUser) {
      navigate("/login");
      return;
    }

    navigate("/notifications");
  };

  const handleGoToLogin = () => {
    navigate("/login");
  };

  const logoutFirebase = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      setCurrentUserProfile(null);
      navigate("/");
    } catch (error) {
      console.error("Lỗi logout:", error);
    }
  };

  const displayName =
    currentUserProfile?.name ||
    currentUser?.displayName ||
    currentUser?.email ||
    "Người dùng";

  return (
    <>
      <Layout style={{ minHeight: "100vh" }}>
        <Header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: tokenAntd.token.colorBgContainer,
            borderBottom: `1px solid ${tokenAntd.token.colorBorderSecondary}`,
            paddingInline: 16,
          }}
        >
          <div
            className="logo flex cursor-pointer items-center"
            style={{ width: 220 }}
            onClick={() => navigate("/")}
          >
            <img
              src={ReactSvg}
              alt="logo"
              style={{
                marginRight: "12px",
                width: "50px",
                height: "50px",
                objectFit: "contain",
              }}
            />
          </div>

          <div className="flex items-center gap-12">
            <Button
              type="text"
              className="text-18"
              icon={<CartBadge />}
              onClick={handleGoToCart}
            />

            <Button
              type="text"
              className="text-18"
              icon={
                <Badge count={0} size="small">
                  <BellOutlined />
                </Badge>
              }
              onClick={handleGoToNotifications}
            />

            {currentUser ? (
              <>
                <div className="flex items-center gap-8 rounded-radius-m bg-color-100 px-12 py-8">
                  <Avatar size="small" icon={<UserOutlined />} />
                  <span className="text-14">{displayName}</span>
                </div>

                <Button
                  className="text-16"
                  icon={<PoweroffOutlined />}
                  type="text"
                  onClick={logoutFirebase}
                >
                  Đăng xuất
                </Button>
              </>
            ) : (
              <Button
                className="text-16"
                icon={<LoginOutlined />}
                type="text"
                onClick={handleGoToLogin}
              >
                Đăng nhập
              </Button>
            )}
          </div>
        </Header>

        <Layout style={{ flex: 1 }}>
          <Sider
            width={260}
            style={{
              backgroundColor: tokenAntd.token.colorBgContainer,
              borderRight: `1px solid ${tokenAntd.token.colorBorderSecondary}`,
            }}
          >
            <Menu
              mode="inline"
              selectedKeys={[selectedMenuKey]}
              openKeys={openKeys}
              onOpenChange={(keys) => setOpenKeys(keys as string[])}
              onClick={(e) => onMenuClick(e.key)}
              items={menuItems}
              style={{
                height: "100%",
                borderRight: 0,
              }}
            />
          </Sider>

          <Layout style={{ display: "flex", flexDirection: "column" }}>
            <Content
              style={{
                padding: 24,
                margin: 0,
                minHeight: 280,
                backgroundColor: tokenAntd.token.colorBgLayout,
              }}
            >
              <Outlet />
            </Content>

            <footer className="bg-[#0f2747] px-24 py-40 text-common-1000 mobile:px-16">
              <div className="mx-auto max-w-[1366px]">
                <div className="text-20 font-bold leading-28">
                  CÔNG TY TNHH QUỐC TẾ HOÀNG TRƯỜNG
                </div>

                <div className="mt-16 grid gap-8 text-14 leading-24 text-common-1000/90">
                  <div>Mã số thuế: 0108.403.163</div>
                  <div>
                    Showroom 1: Số 22, đường Nguyễn Văn Huyên, tổ 24, Phường
                    Quan Hoa, Quận Cầu Giấy, Hà Nội
                  </div>
                  <div>
                    Showroom 2: Số 130 Đường Đại Dương, Vinhomes Ocean Park 2,
                    Văn Giang, Hưng Yên
                  </div>
                  <div>Hotline 1: 0923.66.76.86</div>
                  <div>Hotline 2: 0973.23.11.00</div>
                  <div>Email: htr.trading@gmail.com</div>
                  <div>Website: bontamkcg.com</div>
                </div>
              </div>
            </footer>
          </Layout>
        </Layout>
      </Layout>

      <ChatWidget
        currentUser={currentUser}
        currentUserProfile={currentUserProfile}
      />
    </>
  );
}

export default LayoutSaving;