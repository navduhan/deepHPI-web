import "../index.css";
import Script from "next/script";

const GOOGLE_ANALYTICS_ID = "G-H5HBBZGQ91";

export const metadata = {
  title: "DeepHPI",
  description: "Sequence-based host-pathogen protein interaction prediction.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_ID}`}
        strategy="afterInteractive"
      />
      <Script id="deephpi-google-tag" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GOOGLE_ANALYTICS_ID}');`}
      </Script>
    </html>
  );
}
