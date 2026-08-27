export async function compressMobileImage(
  file: Blob,
  maxSize: number,
): Promise<string> {
  let source = file;
  if (/hei[cf]/i.test(file.type)) {
    const { default: heic2any } = await import("heic2any");
    const converted = await heic2any({ blob: file, toType: "image/jpeg" });
    source = Array.isArray(converted) ? converted[0] : converted;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (readerEvent: ProgressEvent<FileReader>) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        let width = image.width;
        let height = image.height;
        let quality = 0.9;
        let dataUrl = "";

        do {
          canvas.width = width;
          canvas.height = height;
          context?.clearRect(0, 0, canvas.width, canvas.height);
          context?.drawImage(image, 0, 0, width, height);
          dataUrl = canvas.toDataURL("image/jpeg", quality);

          if (dataUrl.length < maxSize) break;
          if (quality > 0.5) {
            quality -= 0.1;
          } else {
            width *= 0.9;
            height *= 0.9;
          }
        } while (dataUrl.length > maxSize);

        resolve(dataUrl);
      };
      image.onerror = reject;
      image.src = String(readerEvent.target?.result || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(source);
  });
}

export function removeMobileImage(imageUrl: string) {
  return fetch(imageUrl, {
    method: "DELETE",
    mode: "cors",
    credentials: "include",
  });
}
