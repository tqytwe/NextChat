export function shouldInlineUploadedImage(
  managedMode: boolean,
  serviceWorkerEnabled: boolean,
) {
  return managedMode || !serviceWorkerEnabled;
}
