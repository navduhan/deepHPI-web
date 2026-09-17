import "../index.css";

export const metadata = {
  title: "DeepHPI",
  description: "Sequence-based host-pathogen protein interaction prediction.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
