import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Button } from "./ui/button";
import { Play, User, LogOut } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface NavbarProps {
    centerContent?: React.ReactNode;
    rightContent?: React.ReactNode;
}

export function Navbar({ centerContent, rightContent }: NavbarProps) {
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

                    {/* Right: Custom content + User actions */}
                    <div className="flex-1 flex items-center justify-end gap-2 sm:gap-4">
                        {rightContent}
                        {user ? (
                            <>
                                <Link
                                    to="/profile#billing"
                                    className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all hover:bg-white/5 group active:scale-95"
                                >
                                    <svg
                                        aria-hidden="true"
                                        focusable="false"
                                        data-prefix="fas"
                                        data-icon="star"
                                        className="h-4 w-4 text-[#febd1b] drop-shadow-[0_0_8px_rgba(254,189,27,0.4)]"
                                        role="img"
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 576 512"
                                    >
                                        <path
                                            fill="currentColor"
                                            d="M316.9 18C311.6 7 300.4 0 288.1 0s-23.4 7-28.8 18L195 150.3 51.4 171.5c-12 1.8-22 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2 12 3 24.2 12.9 31.3s23 8 33.8 2.3l128.3-68.5 128.3 68.5c10.8 5.7 23.9 4.9 33.8-2.3s14.9-19.3 12.9-31.3L438.5 329 542.7 225.9c8.6-8.5 11.7-21.2 7.9-32.7s-13.7-19.9-25.7-21.7L381.2 150.3 316.9 18z"
                                        ></path>
                                    </svg>
                                    <span className="text-sm font-bold text-[#007aff] tracking-tight">Upgrade</span>
                                    <svg
                                        width="14"
                                        height="15"
                                        viewBox="0 0 17 18"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="text-[#ff6b6b] transition-transform group-hover:scale-110 relative -top-[10px]"
                                    >
                                        <path
                                            d="M4.73461 12.0222L13.8933 2.86667M1 9L2.5 1M8.11354 17L16 14.5"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                        ></path>
                                    </svg>
                                </Link>

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
                            </>
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
