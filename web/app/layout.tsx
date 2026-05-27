export const metadata = { title: "CheckMCP — dashboard", description: "Surveille la qualité & la sécurité de tes serveurs MCP." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#0c0c14", color: "#E4E4ED", margin: 0 }}>
        <div style={{ maxWidth: 880, margin: "0 auto", padding: "2rem 1rem" }}>{children}</div>
      </body>
    </html>
  );
}
