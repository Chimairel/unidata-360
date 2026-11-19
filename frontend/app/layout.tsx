import Script from "next/script";
import RootLayout from "@/frontend/layout";
export { metadata } from "@/frontend/layout";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RootLayout>
      <Script
        id="unidata-theme"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: `try{document.documentElement.dataset.theme=localStorage.getItem('unidata-theme')==='dark'?'dark':'light'}catch{}`,
        }}
      />
      {children}
    </RootLayout>
  );
}
