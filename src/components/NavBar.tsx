"use client";

import { Menu } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";

export default function NavBar() {
  function handleLogout() {
    // Placeholder for logout action
    // Integrate with your auth sign-out when available
    console.log("logout clicked");
  }

  return (
    <nav className="w-full bg-black/80 backdrop-blur border-white/10 mb-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="h-14 flex items-center justify-between">
          {/* Left: logo */}
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo.svg"
              alt="echo logo"
              width={96}
              height={96}
              className="w-16 h-16 md:w-24 md:h-24"
              priority
            />
          </Link>

          {/* Right (desktop): links + logout */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              href="/about-us"
              className="text-sm text-zinc-300 hover:text-white transition-colors"
            >
              about us
            </Link>
            <Link
              href="/contact-us"
              className="text-sm text-zinc-300 hover:text-white transition-colors"
            >
              contact us
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="text-sm"
            >
              log out
            </Button>
          </div>

          {/* Right (mobile): burger menu */}
          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="menu"
                  className="h-16 w-16"
                >
                  <Menu className="size-8 text-zinc-300" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="bg-black border-white/20 min-w-0 w-fit"
              >
                <DropdownMenuItem asChild>
                  <Link href="/about-us">about us</Link>
                </DropdownMenuItem>
                <Separator className="bg-white/20" />
                <DropdownMenuItem asChild>
                  <Link href="/contact-us">contact us</Link>
                </DropdownMenuItem>
                <Separator className="bg-white/20" />
                <DropdownMenuItem onSelect={handleLogout}>
                  log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  );
}
