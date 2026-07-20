import { Path } from "../constant";

export type ManagedImageSource = {
  id: string;
  preview: string;
  download?: string;
};

export function getImageStudioBackPath(managedMode: boolean) {
  return managedMode ? Path.Chat : Path.Home;
}

export function getManagedImageSources(item: any): ManagedImageSource[] {
  const assets = (item.assets ?? []) as any[];
  const sources = assets
    .map((asset, index) => ({
      id: asset.id || `${item.id}-${index}`,
      preview: asset.preview_url || asset.url || asset.download_url,
      download: asset.download_url || asset.url || asset.preview_url,
    }))
    .filter((asset) => !!asset.preview);

  if (sources.length === 0 && item.img_data) {
    sources.push({
      id: `${item.id}-image`,
      preview: item.img_data,
      download: item.img_data,
    });
  }

  return sources;
}

export function downloadManagedImage(
  item: any,
  onMultiDownload?: (count: number) => void,
) {
  const sources = getManagedImageSources(item).filter(
    (source) => !!source.download,
  );
  if (sources.length === 0) return;

  sources.forEach((source, index) => {
    const link = document.createElement("a");
    link.href = source.download as string;
    link.download = `${item.job_id || item.id || "image"}${
      sources.length > 1 ? `-${index + 1}` : ""
    }.png`;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  if (sources.length > 1) {
    onMultiDownload?.(sources.length);
  }
}
