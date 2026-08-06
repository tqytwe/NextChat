import { getClientConfig } from "../config/client";

export function shouldInlineUploadedImage(serviceWorkerEnabled: boolean) {
  return !!getClientConfig()?.sub2apiManagedMode || !serviceWorkerEnabled;
}
