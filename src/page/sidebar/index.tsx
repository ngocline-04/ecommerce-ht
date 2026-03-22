import {
  Avatar,
  Box,
  Divider,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Popover,
  Typography,
} from "@mui/material";
import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Telegram,
  Logout,
  SupervisorAccount,
  Settings,
  SupportAgent,
  ChevronLeft,
  ChevronRight,
} from "@mui/icons-material";
import { ImageSvgLocal } from "@/baseComponent/ImageSvgLocal";
import { decodeToken } from "@/utils";
import { ROLE_KEYCLOAK } from "@/constant";
import { useSelector } from "react-redux";
import { getUserInfo } from "@/store/login";
// import { logoutService } from "@/api/login";

const SideBar = () => {
  const location = useLocation();
  const [isCheckSidebar, setIsCheckSidebar] = useState(true);
  const [token, setToken] = useState<any>();
  const [userInfo, setUserInfo] = useState();
  const dispatch = useSelector(getUserInfo)
  useEffect(() => {
    const token = localStorage.getItem("token");
    const result = decodeToken(token!);
    setToken(result);
  }, []);



  useEffect(() => {
    // getDetail(token?.preferred_username);
  }, []);

  return (
    <>
      <Paper
        elevation={3}
        className={`${
          isCheckSidebar ? "w-[230px]" : "w-[80px]"
        } transition-all  duration-500 bg-[#fcfcfc] text-white relative`}
      >
        <Box
          onClick={() => window.location.reload()}
          className="flex justify-center items-center"
        >
          {/* <ImageSvgLocal width="60px" name="LogoPvcombank" /> */}
          {isCheckSidebar && (
            <Typography className="cursor-pointer">Sport Web</Typography>
          )}
        </Box>
        {userInfo === "INACTIVE" ? (
          <>
            <Box
              style={{
                height: "calc(100% - 70px)",
                borderBottomRightRadius: "10px",
              }}
              className="flex flex-col "
            >
              <Box className="h-40 leading-40 mt-12">
                <Box
                  className={`block px-24 hover:bg-[#f0f0f0] rounded-radius-m ${"bg-[#e6fffb] text-[#57d4e6]"}`}
                >
                  <Box className="flex items-center text-14">
                    <Box
                      className={` ${
                        location.pathname === "/"
                          ? "text-[#57d4e6]"
                          : "text-color-black"
                      }`}
                    >
                      {React.cloneElement(<Telegram />, {
                        fontSize: "small",
                      })}
                    </Box>
                    {isCheckSidebar ? (
                      <Box className="ml-8">{"User không hoạt động"}</Box>
                    ) : (
                      " "
                    )}
                  </Box>
                </Box>
                <Divider />
              </Box>
              <FooterSider isCheckSidebar={isCheckSidebar} />
            </Box>
            <Box
              onClick={() => setIsCheckSidebar(!isCheckSidebar)}
              className="absolute top-[20%] right-0 transform translate-x-1/2 -translate-y-1/2 bg-[#ccc] hover:bg-[#ccc] text-white rounded-radius-full p-4 cursor-pointer"
            >
              {isCheckSidebar ? (
                <ChevronLeft fontSize="small" />
              ) : (
                <ChevronRight fontSize="small" />
              )}
            </Box>
          </>
        ) : (
          <>
            <Box
              style={{
                height: "calc(100% - 65px)",
                borderBottomRightRadius: "10px",
              }}
              className="flex flex-col "
            >
              <ul className="flex-grow">
                {mockdata?.map((item) => {
                  const isAdmin = token?.realm_access?.roles.includes(
                    ROLE_KEYCLOAK.ADMIN
                  );
                  const isCreator = token?.realm_access?.roles.includes(
                    ROLE_KEYCLOAK.CREATE
                  );
                  const isApprover = token?.realm_access?.roles.includes(
                    ROLE_KEYCLOAK.APPROVE
                  );
                  const isViewer = token?.realm_access?.roles.includes(
                    ROLE_KEYCLOAK.VIEW
                  );
                  const isApproverDS = token?.realm_access?.roles.includes(
                    ROLE_KEYCLOAK.APPROVE_DS
                  );

                  console.log(isCreator);
                  if (isAdmin) {
                    return (
                      <li key={item.element} className="h-40 leading-40 mt-12">
                        <Link
                          to={item.element}
                          className={`block px-24 hover:bg-[#f0f0f0] rounded-radius-m ${
                            location.pathname === item.element
                              ? "bg-[#e6fffb] text-[#57d4e6]"
                              : "text-color-black"
                          }`}
                        >
                          <Box className="flex items-center text-14">
                            <Box
                              className={` ${
                                location.pathname === item.element
                                  ? "text-[#57d4e6]"
                                  : "text-color-black"
                              }`}
                            >
                              {React.cloneElement(item.icon, {
                                fontSize: "small",
                              })}
                            </Box>
                            {isCheckSidebar ? (
                              <Box className="ml-8">{item.text}</Box>
                            ) : (
                              " "
                            )}
                          </Box>
                        </Link>
                      </li>
                    );
                  }

                  if (
                    item.text === "Loan" &&
                    (isCreator || isApprover || isViewer)
                  ) {
                    return (
                      <li key={item.element} className="h-40 leading-40 mt-12">
                        <Link
                          to={item.element}
                          className={`block px-24 hover:bg-[#f0f0f0] rounded-radius-m ${
                            location.pathname === item.element
                              ? "bg-[#e6fffb] text-[#57d4e6]"
                              : "text-color-black"
                          }`}
                        >
                          <Box className="flex items-center text-14">
                            <Box
                              className={` ${
                                location.pathname === item.element
                                  ? "text-[#57d4e6]"
                                  : "text-color-black"
                              }`}
                            >
                              {React.cloneElement(item.icon, {
                                fontSize: "small",
                              })}
                            </Box>
                            {isCheckSidebar ? (
                              <Box className="ml-8">{item.text}</Box>
                            ) : (
                              " "
                            )}
                          </Box>
                        </Link>
                      </li>
                    );
                  }

                  if (
                    item.text === "Manager Approval" &&
                    (isApproverDS || isCreator)
                  ) {
                    return (
                      <li key={item.element} className="h-40 leading-40 mt-12">
                        <Link
                          to={item.element}
                          className={`block px-24 hover:bg-[#f0f0f0] rounded-radius-m ${
                            location.pathname === item.element
                              ? "bg-[#e6fffb] text-[#57d4e6]"
                              : "text-color-black"
                          }`}
                        >
                          <Box className="flex items-center text-14">
                            <Box
                              className={` ${
                                location.pathname === item.element
                                  ? "text-[#57d4e6]"
                                  : "text-color-black"
                              }`}
                            >
                              {React.cloneElement(item.icon, {
                                fontSize: "small",
                              })}
                            </Box>
                            {isCheckSidebar ? (
                              <Box className="ml-8">{item.text}</Box>
                            ) : (
                              " "
                            )}
                          </Box>
                        </Link>
                      </li>
                    );
                  }

                  if (
                    item.text === "Customer" &&
                    (isViewer || isCreator || isApprover)
                  ) {
                    return (
                      <li key={item.element} className="h-40 leading-40 mt-12">
                        <Link
                          to={item.element}
                          className={`block px-24 hover:bg-[#f0f0f0] rounded-radius-m ${
                            location.pathname === item.element
                              ? "bg-[#e6fffb] text-[#57d4e6]"
                              : "text-color-black"
                          }`}
                        >
                          <Box className="flex items-center text-14">
                            <Box
                              className={` ${
                                location.pathname === item.element
                                  ? "text-[#57d4e6]"
                                  : "text-color-black"
                              }`}
                            >
                              {React.cloneElement(item.icon, {
                                fontSize: "small",
                              })}
                            </Box>
                            {isCheckSidebar ? (
                              <Box className="ml-8">{item.text}</Box>
                            ) : (
                              " "
                            )}
                          </Box>
                        </Link>
                      </li>
                    );
                  }

                  return null;
                })}
              </ul>
              <Divider />
              <FooterSider isCheckSidebar={isCheckSidebar} />
            </Box>
            <Box
              onClick={() => setIsCheckSidebar(!isCheckSidebar)}
              className="absolute top-[20%] right-0 transform translate-x-1/2 -translate-y-1/2 bg-[#ccc] hover:bg-[#ccc] text-white rounded-radius-full p-4 cursor-pointer"
            >
              {isCheckSidebar ? (
                <ChevronLeft fontSize="small" />
              ) : (
                <ChevronRight fontSize="small" />
              )}
            </Box>
          </>
        )}
      </Paper>
    </>
  );
};

const FooterSider = ({ isCheckSidebar }: any) => {
  const [token, setToken] = useState<any>();
  const [anchorEl, setAnchorEl] = React.useState<HTMLButtonElement | null>(
    null
  );

  useEffect(() => {
    const token = localStorage.getItem("token");
    const result = decodeToken(token!);
    setToken(result);
  }, []);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);

  return (
    <>
      <Box
        className={`mt-auto rounded-radius-m cursor-pointer w-full overflow-hidden flex items-center `}
      >
        <Box
          sx={{
            width: `${isCheckSidebar ? "100%" : "120px"}`,
          }}
        >
          <ListItemButton onClick={(e: any) => handleClick(e)}>
            <Avatar alt={token?.upn} src={token?.upn} />
            {isCheckSidebar && (
              <Typography className="pl-12"> {token?.upn}</Typography>
            )}
          </ListItemButton>
          <Popover
            open={open}
            anchorEl={anchorEl}
            onClose={handleClose}
            anchorOrigin={{
              vertical: "top",
              horizontal: "center",
            }}
            transformOrigin={{
              vertical: "bottom",
              horizontal: "center",
            }}
          >
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                flexWrap: "wrap",
                "& > :not(style)": {
                  width: 200,
                  height: 50,
                  display: "flex",
                  alignItems: "center",
                },
              }}
            >
              <Paper onClick={() => {}}>
                <ListItemButton>
                  <ListItemIcon>
                    <Logout />
                  </ListItemIcon>
                  <ListItemText primary="Logout" />
                </ListItemButton>
              </Paper>
            </Box>
          </Popover>
        </Box>
      </Box>
    </>
  );
};

export default SideBar;

export const mockdata = [
  // {
  //   element: "/dashboard/prev-card",
  //   text: "Quản lý ds phê duyệt",
  //   icon: <Telegram />,
  // },
  // {
  //   element: "/kho-so/truy-van",
  //   text: "Kho số",
  //   icon: <SupervisorAccount />,
  // },
  // {
  //   element: "/users",
  //   text: "Quản trị user",
  //   icon: <SupportAgent />,
  // },
  // {
  //   element: "/config",
  //   text: "Cài đặt",
  //   icon: <Settings />,
  // },
];
