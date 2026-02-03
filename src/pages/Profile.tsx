import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Navbar } from "../components/Navbar";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../integrations/supabase/client";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { Label } from "../components/ui/label";
import { Separator } from "../components/ui/separator";
import { User, Lock, CreditCard, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { formatDistance } from "date-fns";

type Section = "profile" | "privacy" | "billing";

export default function Profile() {
    const { user, signOut } = useAuth();
    const [activeSection, setActiveSection] = useState<Section>("profile");
    const [defaultVisibility, setDefaultVisibility] = useState<string>("public");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user) {
            fetchProfile();
        }
    }, [user]);

    const fetchProfile = async () => {
        const { data, error } = await supabase
            .from("profiles")
            .select("default_visibility")
            .eq("id", user?.id)
            .single();

        if (data) {
            setDefaultVisibility(data.default_visibility);
        }
    };

    const updateVisibility = async (value: string) => {
        setDefaultVisibility(value);
        const { error } = await supabase
            .from("profiles")
            .update({ default_visibility: value })
            .eq("id", user?.id);

        if (error) {
            toast.error("Failed to update privacy settings");
        } else {
            toast.success("Privacy settings updated");
        }
    };

    const joinedDate = user?.created_at
        ? formatDistance(new Date(user.created_at), new Date(), { addSuffix: true })
        : "some time ago";

    return (
        <div className="min-h-screen">
            <Navbar />

            <main className="mx-auto max-w-5xl px-4 py-8">
                <Link to="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-6 w-fit transition-colors">
                    <ChevronLeft className="h-4 w-4" />
                    Back to Dashboard
                </Link>

                <div className="flex flex-col md:flex-row gap-8">
                    {/* Sidebar */}
                    <aside className="w-full md:w-64 space-y-1">
                        <button
                            onClick={() => setActiveSection("profile")}
                            className={`flex w-full items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeSection === "profile" ? "bg-secondary text-primary" : "hover:bg-secondary/50"
                                }`}
                        >
                            <User className="h-4 w-4" />
                            My Profile
                        </button>
                        <button
                            onClick={() => setActiveSection("privacy")}
                            className={`flex w-full items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeSection === "privacy" ? "bg-secondary text-primary" : "hover:bg-secondary/50"
                                }`}
                        >
                            <Lock className="h-4 w-4" />
                            Privacy & Security
                        </button>
                        <button
                            onClick={() => setActiveSection("billing")}
                            className={`flex w-full items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeSection === "billing" ? "bg-secondary text-primary" : "hover:bg-secondary/50"
                                }`}
                        >
                            <CreditCard className="h-4 w-4" />
                            Plan & Billing
                        </button>
                    </aside>

                    {/* Content */}
                    <div className="flex-1">
                        {activeSection === "profile" && (
                            <Card className="bg-card">
                                <CardHeader>
                                    <CardTitle className="text-3xl font-bold">Profile</CardTitle>
                                    <CardDescription className="text-muted-foreground">
                                        Contact info, view preferences, and account overview.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <Separator />
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-semibold text-sm">Login</p>
                                                <p className="text-muted-foreground">
                                                    {user?.email} <span className="opacity-70">(Joined {joinedDate})</span>
                                                </p>
                                            </div>
                                            <Link
                                                to="/password"
                                                className="text-primary hover:underline font-semibold"
                                            >
                                                Change Password
                                            </Link>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {activeSection === "privacy" && (
                            <Card className="bg-card">
                                <CardHeader>
                                    <CardTitle className="text-3xl font-bold">Privacy & Security</CardTitle>
                                    <CardDescription className="text-muted-foreground">
                                        Change security and access preferences for your videos that don’t have individual privacy settings.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <Separator />
                                    <div className="space-y-4">
                                        <p className="font-semibold text-sm">Visibility</p>
                                        <RadioGroup
                                            value={defaultVisibility}
                                            onValueChange={updateVisibility}
                                            className="gap-4"
                                        >
                                            <div className="flex items-start space-x-3">
                                                <RadioGroupItem value="public" id="public" className="mt-1" />
                                                <div>
                                                    <Label htmlFor="public" className="font-bold cursor-pointer">Public</Label>
                                                    <p className="text-sm text-muted-foreground">Anyone with a link can view.</p>
                                                </div>
                                            </div>

                                            <div className="flex items-start space-x-3 opacity-50 cursor-not-allowed">
                                                <RadioGroupItem value="hide" id="hide" disabled className="mt-1" />
                                                <div>
                                                    <Label htmlFor="hide" className="font-bold">Hide on StreamShare <span className="text-xs bg-primary/20 text-primary px-1 rounded ml-1">BASIC</span></Label>
                                                    <p className="text-sm text-muted-foreground">Private on your account, but embeddable anywhere.</p>
                                                </div>
                                            </div>

                                            <div className="flex items-start space-x-3">
                                                <RadioGroupItem value="private" id="private" className="mt-1" />
                                                <div>
                                                    <Label htmlFor="private" className="font-bold cursor-pointer">Private</Label>
                                                    <p className="text-sm text-muted-foreground">Only you will be able to view.</p>
                                                </div>
                                            </div>
                                        </RadioGroup>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {activeSection === "billing" && (
                            <Card className="bg-card">
                                <CardHeader>
                                    <CardTitle className="text-3xl font-bold">Plan & Billing</CardTitle>
                                    <CardDescription className="text-muted-foreground">
                                        Manage your subscription and billing details.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Separator className="mb-6" />
                                    <div className="p-8 text-center border-2 border-dashed border-muted rounded-lg">
                                        <p className="text-muted-foreground">Billing details will appear here once connected to Stripe.</p>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
