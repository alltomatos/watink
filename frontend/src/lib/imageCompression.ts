/**
 * Comprime/redimensiona imagem para base64 mantendo qualidade aceitável.
 * Limita a dimensão máxima e qualidade JPEG para evitar exceder limites de DB.
 */

const MAX_IMAGE_SIZE_CHARS = 60000; // Margem de segurança antes do limite de 65535
const MAX_DIMENSION = 1024; // Redimensiona para até 1024x1024
const JPEG_QUALITY = 0.75; // Qualidade JPEG (0-1)

export const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;

        // Redimensiona se necessário
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
          width *= ratio;
          height *= ratio;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Falha ao obter contexto do canvas"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Tenta JPEG com qualidade decrescente até caber no limite
        let quality = JPEG_QUALITY;
        let result = canvas.toDataURL("image/jpeg", quality);

        while (result.length > MAX_IMAGE_SIZE_CHARS && quality > 0.1) {
          quality -= 0.1;
          result = canvas.toDataURL("image/jpeg", quality);
        }

        if (result.length > MAX_IMAGE_SIZE_CHARS) {
          reject(
            new Error(
              `Imagem ainda muito grande após compressão (${(result.length / 1024).toFixed(1)}KB). Tente uma imagem menor.`
            )
          );
          return;
        }

        resolve(result);
      };

      img.onerror = () => {
        reject(new Error("Falha ao carregar imagem"));
      };

      img.src = event.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error("Falha ao ler arquivo"));
    };

    reader.readAsDataURL(file);
  });
};
