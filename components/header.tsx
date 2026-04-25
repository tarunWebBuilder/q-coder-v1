"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

type User = {
  id: string;
  email: string;
  firstName?: string;
  profilePictureUrl?: string;
};

export default function Header() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b bg-white">
      
      {/* Logo */}
      <Link href="/" className="text-lg font-semibold">
        Parexa
      </Link>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger className="outline-none">
              <Avatar className="h-9 w-9 cursor-pointer">
                <AvatarImage src={user.profilePictureUrl} />
                <AvatarFallback>
                  {(user.firstName || user.email)?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-48">
              <div className="px-2 py-1.5 text-sm text-gray-500">
                {user.firstName || user.email}
              </div>

              <DropdownMenuItem asChild>
                <Link href="/api/sso/logout">Logout</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Link
            href="/api/sso/login"
            className="rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-gray-800"
          >
            Login
          </Link>
        )}
      </div>
    </header>
  );
}