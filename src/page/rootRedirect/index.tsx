import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { hideLoading, showLoading } from "../loading";
import  { mockdata } from "../sidebar";
import { decodeToken } from "@/utils";
import { ROLE_KEYCLOAK } from "@/constant";
import { Card } from "antd";


const RootRedirect = () => {
  const [filteredRoutes, setFilteredRoutes] = useState<any[]>([]);
  const navigate = useNavigate();
  
  useEffect(() => {
    const token = localStorage.getItem("token");
    const result = decodeToken(token!);
    const userRoles = result?.realm_access?.roles || [];
    const isAdmin = userRoles.includes(ROLE_KEYCLOAK.ADMIN);
    const isCreator = userRoles.includes(ROLE_KEYCLOAK.CREATE);
    const isApprover = userRoles.includes(ROLE_KEYCLOAK.APPROVE);
    const isViewer = userRoles.includes(ROLE_KEYCLOAK.VIEW);
    const isApproverDS = userRoles.includes(ROLE_KEYCLOAK.APPROVE_DS);

    const filtered = mockdata.filter((item) => {
      if (isAdmin) return true;
      if (item.text === "Loan" && (isCreator || isApprover || isViewer)) return true;
      if (item.text === "Manager Approval" && (isApproverDS || isCreator)) return true;
      if (item.text === "Customer" && (isViewer || isCreator || isApprover)) return true;
      return false;
    });

    setFilteredRoutes(filtered);
  }, []);

  useEffect(() => {
    showLoading();
    const timer = setTimeout(() => {
      navigate(filteredRoutes[0]?.element);
      hideLoading();
    }, 100);

    return () => {
      clearTimeout(timer);
      hideLoading();
    };
  }, [filteredRoutes]);

  return <Card className="h-[100vh]">

  </Card>;
};

export default RootRedirect;


