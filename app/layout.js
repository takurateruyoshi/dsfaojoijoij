import "./globals.css";

export const metadata = {
  title: "Star RPG",
  description: "星と三角の小さなRPG",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
