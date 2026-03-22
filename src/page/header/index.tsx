import React from "react";
import { AppBar, Toolbar, IconButton, Box, Avatar } from "@mui/material";
import { ImageSvgLocal } from "@/baseComponent/ImageSvgLocal";
import { NotificationsNone, AccountCircle, Logout } from "@mui/icons-material";
import BaseTooltip from "@/baseComponent/baseTooltip";
import { logoutService } from "@/api/login";

const Header = () => {
  const menuItems = [
    {
      text: "Account",
      icon: <AccountCircle />,
      onClick: () => {
        console.log("Account clicked");
      },
    },
    {
      text: "Logout",
      icon: <Logout />,
      onClick: logoutService,
    },
  ];

  return (
    <AppBar className="!bg-color-50" position="static">
      <Toolbar className="flex justify-between">
        <ImageSvgLocal width="60px" name="LogoPvcombank" />
        <Box className="flex items-center">
          <BaseTooltip menuItems="Notifications">
            <IconButton>
              <NotificationsNone />
            </IconButton>
          </BaseTooltip>
          <BaseTooltip menuItems={menuItems}>
            <IconButton size="large">
              <Avatar alt="Remy Sharp" src="" />
            </IconButton>
          </BaseTooltip>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
