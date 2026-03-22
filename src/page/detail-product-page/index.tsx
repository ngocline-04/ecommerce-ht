import { memo } from "react";

const Component = () => {
  return <div className="block-content"></div>;
};

const DetailProductPage = memo(Component);

export { DetailProductPage };
