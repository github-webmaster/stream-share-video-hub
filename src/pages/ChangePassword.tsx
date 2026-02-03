import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../integrations/supabase/client";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "../components/ui/card";
import { Navbar } from "../components/Navbar";
import { ChevronLeft, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

export default function ChangePassword() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword !== confirmPassword) {
            toast.error("New passwords do not match");
            return;
        }

        if (newPassword.length < 6) {
            toast.error("Password must be at least 6 characters");
            return;
        }

        setLoading(true);

        try {
            // 1. Verify current password by attempting to sign in
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: user?.email || "",
                password: currentPassword,
            });

            if (signInError) {
                toast.error("Incorrect current password");
                setLoading(false);
                return;
            }

            // 2. Update password
            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword,
            });

            if (updateError) {
                toast.error(updateError.message);
            } else {
                toast.success("Password updated successfully");
                navigate("/");
            }
        } catch (err) {
            console.error("Password change error:", err);
            toast.error("An unexpected error occurred");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen">
            <Navbar />

            <main className="mx-auto max-w-lg px-4 py-12">
                <Link to="/profile" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-6 w-fit transition-colors">
                    <ChevronLeft className="h-4 w-4" />
                    Back to Profile
                </Link>

                <Card className="border-border shadow-lg">
                    <CardHeader className="space-y-1">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-2 bg-primary/10 rounded-full">
                                <Lock className="h-5 w-5 text-primary" />
                            </div>
                            <CardTitle className="text-2xl">Change Password</CardTitle>
                        </div>
                        <CardDescription>
                            Update your account password. You will be redirected to the dashboard after success.
                        </CardDescription>
                    </CardHeader>
                    <form onSubmit={handlePasswordChange}>
                        <CardContent className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label htmlFor="currentPassword">Current Password</Label>
                                <Input
                                    id="currentPassword"
                                    type="password"
                                    placeholder="••••••••"
                                    required
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    className="bg-secondary/50"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="newPassword">New Password</Label>
                                <Input
                                    id="newPassword"
                                    type="password"
                                    placeholder="••••••••"
                                    required
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="bg-secondary/50"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    placeholder="••••••••"
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="bg-secondary/50"
                                />
                            </div>
                        </CardContent>
                        <CardFooter className="pt-6">
                            <Button type="submit" className="w-full" disabled={loading}>
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Updating...
                                    </>
                                ) : (
                                    "Change Password"
                                )}
                            </Button>
                        </CardFooter>
                    </form>
                </Card>
            </main>
        </div>
    );
}
