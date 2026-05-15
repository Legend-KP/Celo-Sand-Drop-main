import { useEffect } from "react";
import { useConnect, useConnectors } from "wagmi";

export function useAutoConnect() {
  const connectors = useConnectors();
  const { connect } = useConnect();

  useEffect(() => {
    if (connectors.length > 0) {
      connect({ connector: connectors[0] });
    }
  }, [connectors, connect]);
}
