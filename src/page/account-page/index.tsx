import { memo } from "react";

const Component = () => {
  return <div className="block-content"></div>;
};

const AccountPage = memo(Component);

export { AccountPage };
