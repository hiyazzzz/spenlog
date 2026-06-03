import React from "react";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/components/ui/BottomNav";
import ThemeProvider from "@/components/ui/ThemeProvider";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let theme = 'Burgundy';
  if (user) {
    const { data: profile } = await supabase
      .from('users').select('theme').eq('id', user.id).single();
    theme = profile?.theme ?? 'Burgundy';
  }

  return (
    <div className="min-h-screen flex flex-col justify-between" style={{ background: 'var(--color-bg)' }}>
      <ThemeProvider theme={theme} />
      <main className="flex-1 w-full max-w-md mx-auto p-4 pb-24">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
