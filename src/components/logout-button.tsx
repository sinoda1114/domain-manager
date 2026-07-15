"use client";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
export function LogoutButton() { const router = useRouter(); return <button className="user-button" type="button" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); await signOut({ redirect: false }).catch(() => undefined); router.replace("/login"); router.refresh(); }}>ログアウト</button>; }
