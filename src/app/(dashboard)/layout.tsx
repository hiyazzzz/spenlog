import React from "react";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/components/ui/BottomNav";
import ThemeProvider from "@/components/ui/ThemeProvider";
import GuideOverlay from "@/components/onboarding/GuideOverlay";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let theme = 'Burgundy';
  let guideCompleted = true;
  let userId = '';

  if (user) {
    const { data: profile } = await supabase
      .from('users').select('theme, guide_completed').eq('id', user.id).single();
    theme = profile?.theme ?? 'Burgundy';
    guideCompleted = profile?.guide_completed ?? false;
    userId = user.id;
  }

  return (
    <div className="min-h-screen flex flex-col justify-between" style={{ 