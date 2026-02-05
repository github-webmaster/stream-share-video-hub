import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "../components/ui/card";
import { Navbar } from "../components/Navbar";
import { ChevronLeft, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

export default function ChangeEmail() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [newEmail, setNewEmail] = useState("");
    const [password, setPassword] = useState("");

    const handleEmailChange = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!newEmail || !password) {
            toast.error("Please fill in all fields");
            return;
        }

        setLoading(true);

        try {
            await authApi.updateEmail(newEmail, password);
            toast.success("Email updated successfully");
            navigate("/profile");
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Failed to update email";
            toast.error(errorMessage);
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
                                <Mail className="h-5 w-5 text-primary" />
                            </div>
                            <CardTitle className="text-2xl">Change Email</CardTitle>
                        </div>
                        <CardDescription>
                            Update your account email. You will be redirected to your profile after success.
                        </CardDescription>
                    </CardHeader>
                    <form onSubmit={handleEmailChange}>
                        <CardContent className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label htmlFor="currentEmail">Current Email</Label>
                                <Input
                                    id="currentEmail"
                                    type="email"
                                    value={user?.email || ""}
                                    readOnly
                                    className="bg-secondary/50 text-muted-foreground"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="newEmail">New Email</Label>
                                <Input
                                    id="newEmail"
                                    type="email"
                                    placeholder="your.new@email.com"
                                    required
                                    value={newEmail}
                                    onChange={(e) => setNewEmail(e.target.value)}
                                    className="bg-secondary/50"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">Confirm Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
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
                                    "Change Email"
                                )}
                            </Button>
                        </CardFooter>
                    </form>
                </Card>
            </main>
        </div>
    );
}
