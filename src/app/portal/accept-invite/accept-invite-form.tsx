"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { acceptInviteAction } from "./actions";

export function AcceptInviteForm({ token }: { token: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const router = useRouter();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    start(async () => {
      const res = await acceptInviteAction({ token, email: trimmed, password });
      if (!res.ok) {
        setError(res.error);
        toast.push(res.error, "error");
        return;
      }
      // Auto-logged in. Redirect to portal home.
      toast.push("Welcome", "success");
      router.push("/portal");
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Input
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        required
        autoComplete="email"
      />
      <Input
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="At least 8 characters"
        required
        autoComplete="new-password"
      />
      <Input
        label="Confirm password"
        type="password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        required
        autoComplete="new-password"
      />

      {error && (
        <div className="rounded-md border border-danger-500/30 bg-danger-500/5 px-3 py-2 text-xs text-danger-700 dark:text-danger-500">
          {error}
        </div>
      )}

      <Button type="submit" loading={pending} className="w-full">
        Create account and continue
      </Button>
    </form>
  );
}