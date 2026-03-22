import { Badge } from "antd";
import { ShoppingCartOutlined } from "@ant-design/icons";
import React, { useCallback, useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/App";

export const CartBadge = () => {
  const [cartCount, setCartCount] = useState<
    { id: string; [key: string]: any }[]
  >([]);

  const getProductInCart = useCallback(async () => {
    const colRef = collection(db, "CartPending");
    const snapshot = await getDocs(colRef);
    const result = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    setCartCount(result);
}, []);

  useEffect(() => {
    getProductInCart();
  }, []);

  return (
    <Badge count={cartCount?.length} size="small">
      <ShoppingCartOutlined />
    </Badge>
  );
};
