import "./globals.css";
export const metadata = {
  title: "HackMatch — Find your people",
  description:
    "Discover tracks, fill skill gaps and build your hackathon team.",
};
export default function Layout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
