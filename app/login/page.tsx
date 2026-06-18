"use client";

import { useState } from "react";
import { createClient } from "@/infrastructure/database/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  async function signInWithGoogle() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setLoading(false);
      console.error(error);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50 p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Whileone
          </p>
          <CardTitle className="mt-2 text-xl">
            AI Client Outreach Assistant
          </CardTitle>
          <CardDescription>
            Sign in with your Google account to access the internal outreach
            platform.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full"
            onClick={signInWithGoogle}
            disabled={loading}
          >
            {loading ? "Redirecting…" : "Continue with Google"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
