import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Button } from "./ui/button";
import { Play, User, LogOut } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface NavbarProps {
    centerContent?: React.ReactNode;
}

export function Navbar({ centerContent }: NavbarProps) {
    const { user, signOut } = useAuth();

    return (
        <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0e0e10]/80 backdrop-blur-xl">
            <div className="mx-auto max-w-7xl px-4 py-3">
                {/* Desktop and Tablet: Standard 3-column Grid */}
                <div className="hidden sm:grid grid-cols-3 items-center w-full">
                    {/* Left: Logo */}
                    <div className="flex items-center">
                        <Link to="/" className="flex items-center gap-2 text-lg font-semibold w-fit active:opacity-70">
                            <Play className="h-5 w-5 fill-primary text-primary" />
                            <span>StreamShare Hub</span>
                        </Link>
                    </div>

                    {/* Center: Upload controls */}
                    <div className="flex justify-center">
                        {centerContent}
                    </div>

                    {/* Right: User actions */}
                    <div className="flex items-center justify-end gap-3">
                        {user ? (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="gap-2">
                                        <User className="h-4 w-4" />
                                        My Account
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                    <DropdownMenuItem asChild>
                                        <Link to="/profile" className="flex items-center cursor-pointer">
                                            <User className="h-4 w-4 mr-2" />
                                            My Profile
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive cursor-pointer">
                                        <LogOut className="h-4 w-4 mr-2" />
                                        Sign out
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : (
                            <Button asChild variant="default">
                                <Link to="/">Sign up for free</Link>
                            </Button>
                        )}
                    </div>
                </div>

                {/* Mobile: Two-Row Stacked Layout */}
                <div className="flex sm:hidden flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <Link to="/" className="flex items-center gap-2 text-md font-semibold active:opacity-70">
                            <Play className="h-5 w-5 fill-primary text-primary" />
                            <span>StreamShare</span>
                        </Link>

                        <div className="flex items-center gap-2">
                            {user ? (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-9 px-3">
                                            <User className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48">
                                        <DropdownMenuItem asChild>
                                            <Link to="/profile" className="flex items-center">
                                                <User className="h-4 w-4 mr-2" />
                                                My Profile
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={signOut} className="text-destructive">
                                            <LogOut className="h-4 w-4 mr-2" />
                                            Sign out
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            ) : (
                                <Button asChild variant="default" size="sm">
                                    <Link to="/">Sign in</Link>
                                </Button>
                            )}
                        </div>
                    </div>

                    {centerContent && (
                        <div className="flex justify-center w-full animate-in fade-in slide-in-from-top-2 duration-300">
                            {centerContent}
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
