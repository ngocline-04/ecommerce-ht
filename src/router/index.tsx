import ErrorPage from "@/page/errorPage";
import Nav from "@/page/navbar";
import { createBrowserRouter, Navigate } from "react-router-dom";
import LoginPage from "@/page/login";
import { auth } from "@/App";
import React from "react";
import HomePage from "@/page/home-page";
import ListProductPage from "@/page/products-page";
import CartPage from "@/page/cart-page";

// TODO: thay bằng page thật của bạn
const CheckoutPage = () => <div>Thanh toán</div>;
const ProfilePage = () => <div>Thông tin cá nhân</div>;
const OrdersPage = () => <div>Đơn hàng của tôi</div>;

const ProtectedRoute = ({
  element,
}: {
  element: React.ReactNode;
  requiredRoles?: string[];
  titleId?: string;
}) => {
  const user = auth.currentUser;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{element}</>;
};

const GuestRoute = ({ element }: { element: React.ReactNode }) => {
  const user = auth.currentUser;

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{element}</>;
};

export const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <Nav />,
      errorElement: <ErrorPage />,
      children: [
        // Public homepage
        {
          index: true,
          element: <HomePage />,
          errorElement: <ErrorPage isLogout={false} />,
        },
        {
          path: "/list-product",
          element: (
            <ProtectedRoute
              element={<ListProductPage />}
              titleId="Danh sách sản phẩm"
            />
          ),
          errorElement: <ErrorPage isLogout={false} />,
        },
        // Protected routes
        {
          path: "cart",
          element: <ProtectedRoute element={<CartPage />} titleId="Giỏ hàng" />,
          errorElement: <ErrorPage isLogout={false} />,
        },
        {
          path: "checkout",
          element: (
            <ProtectedRoute element={<CheckoutPage />} titleId="Thanh toán" />
          ),
          errorElement: <ErrorPage isLogout={false} />,
        },
        {
          path: "profile",
          element: (
            <ProtectedRoute
              element={<ProfilePage />}
              titleId="Thông tin cá nhân"
            />
          ),
          errorElement: <ErrorPage isLogout={false} />,
        },
        {
          path: "orders",
          element: (
            <ProtectedRoute
              element={<OrdersPage />}
              titleId="Đơn hàng của tôi"
            />
          ),
          errorElement: <ErrorPage isLogout={false} />,
        },
      ],
    },

    {
      path: "/login",
      element: <GuestRoute element={<LoginPage />} />,
    },

    {
      path: "/error",
      element: <ErrorPage />,
    },
  ],
  {
    basename: "/",
  },
);
