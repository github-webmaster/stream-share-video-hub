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
                <div className="flex items-center justify-between w-full gap-4">
                    {/* Left: Logo */}
                    <div className="flex-1 flex justify-start">
                        <Link to="/" className="flex items-center gap-2 text-lg font-semibold active:opacity-70 whitespace-nowrap">
                            <Play className="h-5 w-5 fill-primary text-primary" />
                            <span className="hidden xs:inline">StreamShare Hub</span>
                            <span className="xs:hidden">Hub</span>
                        </Link>
                    </div>

                    {/* Center: Upload controls - Perfectly Centered */}
                    {centerContent && (
                        <div className="flex-shrink-0 flex justify-center">
                            {centerContent}
                        </div>
                    )}

                    {/* Right: User actions */}
                    <div className="flex-1 flex items-center justify-end gap-2 sm:gap-3">
                        {user ? (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="gap-2 h-9 px-2 sm:px-4">
                                        <User className="h-4 w-4" />
                                        <span className="hidden sm:inline">My Account</span>
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
                            <Button asChild variant="default" size="sm">
                                <Link to="/">Register / Login</Link>
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
