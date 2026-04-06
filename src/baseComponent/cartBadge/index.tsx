import { Badge } from "antd";
import { ShoppingCartOutlined } from "@ant-design/icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "@/App";

export const CartBadge = () => {
  const [cartCount, setCartCount] = useState(0);

  const getProductInCart = useCallback(async () => {
    try {
      const currentEmail = auth.currentUser?.email;

      if (!currentEmail) {
        setCartCount(0);
        return;
      }

      const userQuery = query(
        collection(db, "Users"),
        where("email", "==", currentEmail),
        where("isStaff", "==", false),
      );

      const userSnapshot = await getDocs(userQuery);
      const userDoc = userSnapshot.docs[0];

      if (!userDoc) {
        setCartCount(0);
        return;
      }

      const userId = userDoc.id;

      const cartQuery = query(
        collection(db, "CartPending"),
        where("idUser", "==", userId),
      );

      const cartSnapshot = await getDocs(cartQuery);

      setCartCount(cartSnapshot.docs.length);
    } catch (error) {
      console.error("Lấy số lượng giỏ hàng thất bại:", error);
      setCartCount(0);
    }
  }, []);

  useEffect(() => {
    getProductInCart();

    const unsubscribe = auth.onAuthStateChanged(() => {
      getProductInCart();
    });

    return () => unsubscribe();
  }, [getProductInCart]);

  return (
    <Badge count={cartCount} size="small">
      <ShoppingCartOutlined />
    </Badge>
  );
};