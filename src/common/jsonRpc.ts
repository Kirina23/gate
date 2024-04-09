export class JSONRPCPacket {
  jsonrpc!: "2.0";
  id!: string | number;
  method?: string;
  params?: any;
  result?: any;
  errors?: any[];
}

export const validateRpcRequest = (payload: any): boolean => {
  return (
    payload &&
    payload.jsonrpc === "2.0" &&
    payload.id !== undefined &&
    payload.method &&
    payload.method.length > 0
  );
};

export const validateRpcRequestTimeout = (payload: any): boolean => {
  return (
    !payload.params ||
    !payload.params.timeout ||
    payload.params.timeout > Date.now()
  );
};

export const getJsonRpcSuccessResponse = (
  id: number | string,
  result: any
): JSONRPCPacket => {
  return {
    jsonrpc: "2.0",
    id,
    result,
  };
};

export const getJsonRpcErrorResponse = (
  id: number | string,
  errors: any
): JSONRPCPacket => {
  return {
    jsonrpc: "2.0",
    id,
    errors,
  };
};
