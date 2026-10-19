export const createGoogleSiteVerificationHtmlPlugin = ({ verificationToken } = {}) => {
  const token = String(verificationToken || "").trim();

  return {
    name: "faako-google-site-verification-html",
    transformIndexHtml() {
      if (!token) return;

      return [
        {
          tag: "meta",
          attrs: {
            name: "google-site-verification",
            content: token,
          },
          injectTo: "head",
        },
      ];
    },
  };
};
