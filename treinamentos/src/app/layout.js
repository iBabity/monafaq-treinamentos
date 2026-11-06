import "./globals.css";

export const metadata = {
  title: "Monalisa Treinamentos",
  description: "Plataforma de treinamentos Monalisa para capacitação em sistemas ERP.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" data-theme="light" data-scroll-behavior="smooth">
      <head>
        <link rel="icon" href="/static/uploads/logos/Logo1.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Playfair+Display:wght@700&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
