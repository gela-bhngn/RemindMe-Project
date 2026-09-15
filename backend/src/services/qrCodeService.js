import QRCode from "qrcode";

export async function generateQRCode(text, options = {}) {
  try {
    const defaultOptions = {
      errorCorrectionLevel: "H",
      type: "image/png",
      quality: 0.92,
      margin: 1,
      width: 300,
      color: {
        dark: "#000000",
        light: "#FFFFFF"
      }
    };

    const qrCodeDataUrl = await QRCode.toDataURL(text, { ...defaultOptions, ...options });
    return qrCodeDataUrl;
  } catch (error) {
    console.error("QR Code generation error:", error);
    throw error;
  }
}

export async function generateQRCodeAsBuffer(text, options = {}) {
  try {
    const buffer = await QRCode.toBuffer(text, options);
    return buffer;
  } catch (error) {
    console.error("QR Code buffer generation error:", error);
    throw error;
  }
}
