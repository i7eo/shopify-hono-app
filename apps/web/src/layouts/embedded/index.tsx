import { EmbeddedFooter } from "./footer";
import { EmbeddedMain } from "./main";
import { EmbeddedSider } from "./sider";

export function EmbeddedLayout() {
  return (
    <>
      <EmbeddedSider />
      <EmbeddedMain />
      <EmbeddedFooter />
    </>
  );
}
