import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useAdmin } from "../hooks/useAdmin";
import { Button } from "./ui/button";
import { Play, User, UserCircle, LogOut, Upload } from "lucide-react";
import { useUploadContext } from "../contexts/UploadContext";
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
    const { isAdmin } = useAdmin();
    const { isUploading } = useUploadContext();
    const navigate = useNavigate();

    const handleUploadClick = () => {
        declare global {
            interface Window {
                triggerGlobalUpload?: () => void;
            }
        }
        window.triggerGlobalUpload?.();
    };

    return (
        <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0e0e10]">
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
                    <div className="flex-shrink-0 flex justify-center">
                        {centerContent || (user && (
                            <Button
                                variant="ghost"
                                onClick={handleUploadClick}
                                disabled={isUploading}
                                className="px-4 sm:px-6 font-semibold text-white/70 hover:text-white"
                            >
                                <Upload className="h-4 w-4 mr-0 sm:mr-2" />
                                <span className="hidden sm:inline">Upload video</span>
                                <span className="inline sm:hidden">Upload</span>
                            </Button>
                        ))}
                    </div>

                    {/* Right: Custom content + User actions */}
                    <div className="flex-1 flex items-center justify-end gap-2 sm:gap-4">
                        {rightContent}
                        {user ? (
                            <>
                                {/* Removed Admin Panel block from primary nav bar. Only in dropdown now. */}

                                <DropdownMenu modal={false}>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm" className="gap-2 h-9 px-2 sm:px-4">
                                            <User className="h-4 w-4" />
                                            <span className="hidden sm:inline">My Account</span>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48">
                                        <DropdownMenuItem
                                            onClick={() => {
                                                navigate('/profile', { replace: false });
                                            }}
                                            className="flex items-center cursor-pointer"
                                        >
                                            <UserCircle className="h-4 w-4 mr-2" />
                                            My Profile
                                        </DropdownMenuItem>
                                        {/* Admin Panel link for admin users only */}
                                        {isAdmin && (
                                            <>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem asChild>
                                                    <Link to="/admin" className="flex items-center cursor-pointer">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-settings h-5 w-5 mr-2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                                        Admin Panel
                                                    </Link>
                                                </DropdownMenuItem>
                                            </>
                                        )}
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
