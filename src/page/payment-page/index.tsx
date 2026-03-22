import { memo } from "react";

const Component = () => {
  return <div className="block-content"></div>;
};

const PaymentPage = memo(Component);

export { PaymentPage };
