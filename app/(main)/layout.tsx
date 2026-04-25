import Providers from "@/app/(main)/providers";
import { Toaster } from "@/components/ui/toaster";

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      {children}
      <Toaster />
    </Providers>
  );
}