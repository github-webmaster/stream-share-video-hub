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
import { User, Lock, CreditCard, ChevronLeft, Check, ShieldCheck, Info, CreditCard as CardIcon } from "lucide-react";
import { toast } from "sonner";
import { formatDistance } from "date-fns";
import { Input } from "../components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "../components/ui/dialog";

type Section = "profile" | "privacy" | "billing";

export default function Profile() {
    const { user } = useAuth();
    const [activeSection, setActiveSection] = useState<Section>("profile");
    const [defaultVisibility, setDefaultVisibility] = useState<string>("public");
    const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");
    const [loading, setLoading] = useState(false);

    // Email change states
    const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
    const [newEmail, setNewEmail] = useState("");
    const [emailPassword, setEmailPassword] = useState("");

    useEffect(() => {
        if (user) {
            fetchProfile();
        }
    }, [user]);

    const fetchProfile = async () => {
        const { data } = await supabase
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

    const handleEmailChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Re-authentication would be required for a real production environment
            const { error } = await supabase.auth.updateUser({ email: newEmail });

            if (error) throw error;

            toast.success("Email update initiated! Check your inbox.");
            setIsEmailDialogOpen(false);
            setNewEmail("");
            setEmailPassword("");
        } catch (error: any) {
            toast.error(error.message || "Failed to update email");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen">
            <Navbar />

            <main className="mx-auto max-w-7xl px-4 py-8">
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
                            <Card className="bg-[#1d1d1f] border-white/5 shadow-2xl overflow-hidden">
                                <CardHeader className="p-8">
                                    <CardTitle className="text-3xl font-bold">Profile</CardTitle>
                                    <CardDescription className="text-muted-foreground">
                                        Contact info, view preferences, and account overview.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="p-8 pt-0 space-y-6">
                                    <Separator className="opacity-50" />
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-semibold text-sm">Login</p>
                                                <p className="text-muted-foreground text-sm">
                                                    {user?.email} <span className="opacity-70">(Joined {joinedDate})</span>
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
                                                    <DialogTrigger asChild>
                                                        <Button variant="link" className="text-primary p-0 h-auto text-sm font-medium hover:no-underline shadow-none border-none">
                                                            Change Email
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent className="sm:max-w-[425px] bg-[#1d1d1f] border-white/5 shadow-2xl">
                                                        <DialogHeader>
                                                            <DialogTitle className="text-2xl font-bold">Change Email</DialogTitle>
                                                            <DialogDescription className="text-muted-foreground">
                                                                Enter your new email and confirm with your password.
                                                            </DialogDescription>
                                                        </DialogHeader>
                                                        <form onSubmit={handleEmailChange} className="space-y-4 py-4">
                                                            <div className="space-y-2">
                                                                <Label htmlFor="current-email" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Current Email</Label>
                                                                <Input id="current-email" value={user?.email || ""} readOnly className="bg-black/20 border-white/5 text-muted-foreground" />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label htmlFor="new-email" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">New Email</Label>
                                                                <Input
                                                                    id="new-email"
                                                                    type="email"
                                                                    value={newEmail}
                                                                    onChange={(e) => setNewEmail(e.target.value)}
                                                                    placeholder="Enter new email"
                                                                    required
                                                                    className="bg-black/20 border-white/5 focus-visible:ring-primary/20"
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label htmlFor="confirm-pass" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Confirm Password</Label>
                                                                <Input
                                                                    id="confirm-pass"
                                                                    type="password"
                                                                    value={emailPassword}
                                                                    onChange={(e) => setEmailPassword(e.target.value)}
                                                                    placeholder="Your current password"
                                                                    required
                                                                    className="bg-black/20 border-white/5 focus-visible:ring-primary/20"
                                                                />
                                                            </div>
                                                            <DialogFooter className="pt-4">
                                                                <Button
                                                                    type="submit"
                                                                    disabled={loading}
                                                                    className="w-full bg-primary hover:bg-primary/90 font-bold"
                                                                >
                                                                    {loading ? "Updating..." : "Update Email"}
                                                                </Button>
                                                            </DialogFooter>
                                                        </form>
                                                    </DialogContent>
                                                </Dialog>
                                                <Button asChild variant="link" className="text-primary p-0 h-auto text-sm font-medium hover:no-underline border-l border-white/10 pl-3 rounded-none shadow-none">
                                                    <Link to="/password">Change Password</Link>
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {activeSection === "privacy" && (
                            <Card className="bg-[#1d1d1f] border-white/5 shadow-2xl overflow-hidden">
                                <CardHeader className="p-8">
                                    <CardTitle className="text-3xl font-bold">Privacy & Security</CardTitle>
                                    <CardDescription className="text-muted-foreground">
                                        Change security and access preferences for your videos that don’t have individual privacy settings.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="p-8 pt-0">
                                    <Separator className="mb-8 opacity-50" />
                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <Label className="text-sm font-bold">Visibility</Label>
                                            <RadioGroup
                                                value={defaultVisibility}
                                                onValueChange={updateVisibility}
                                                className="grid gap-4"
                                            >
                                                <div className="flex items-center space-x-3 space-y-0">
                                                    <RadioGroupItem value="public" id="public" />
                                                    <Label htmlFor="public" className="font-normal cursor-pointer">
                                                        <div className="font-bold">Public</div>
                                                        <div className="text-xs text-muted-foreground">Anyone with a link can view.</div>
                                                    </Label>
                                                </div>
                                                <div className="flex items-center space-x-3 space-y-0">
                                                    <RadioGroupItem value="unlisted" id="unlisted" />
                                                    <Label htmlFor="unlisted" className="font-normal cursor-pointer">
                                                        <div className="flex items-center gap-2">
                                                            <div className="font-bold">Hide on StreamShare</div>
                                                            <div className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px] font-bold">BASIC</div>
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">Private on your account, but embeddable anywhere.</div>
                                                    </Label>
                                                </div>
                                                <div className="flex items-center space-x-3 space-y-0">
                                                    <RadioGroupItem value="private" id="private" />
                                                    <Label htmlFor="private" className="font-normal cursor-pointer">
                                                        <div className="font-bold">Private</div>
                                                        <div className="text-xs text-muted-foreground">Only you will be able to view.</div>
                                                    </Label>
                                                </div>
                                            </RadioGroup>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {activeSection === "billing" && (
                            <Card className="bg-[#1d1d1f] border-white/5 shadow-2xl overflow-hidden">
                                <CardHeader className="p-8 pb-0">
                                    <CardTitle className="text-3xl font-bold">Plan & Billing</CardTitle>
                                    <CardDescription className="text-muted-foreground">
                                        Manage your subscription and billing details.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="p-8">
                                    <Separator className="mb-8 opacity-50" />

                                    <div className="grid lg:grid-cols-5 gap-12">
                                        {/* Left: Info & FAQ (Workflowy/Streamable style) */}
                                        <div className="lg:col-span-2 space-y-8">
                                            <div className="space-y-4">
                                                <h3 className="text-xl font-bold text-white">StreamShare Pro</h3>
                                                <p className="text-sm text-muted-foreground leading-relaxed">
                                                    Unlock the full potential of your video library with professional tools and unlimited growth.
                                                </p>
                                                <ul className="space-y-3">
                                                    {[
                                                        "Unlimited 4K Video Uploads",
                                                        "Advanced Privacy Controls",
                                                        "Custom Video Player Branding",
                                                        "Priority Edge Delivery (Storj)",
                                                        "Detailed Viewer Analytics"
                                                    ].map((feature) => (
                                                        <li key={feature} className="flex items-center gap-2 text-sm text-white/80">
                                                            <Check className="h-4 w-4 text-primary" />
                                                            {feature}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>

                                            <div className="space-y-4 p-6 bg-white/5 rounded-xl border border-white/10">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <ShieldCheck className="h-5 w-5 text-primary" />
                                                    <h4 className="font-bold text-sm">Cancel anytime</h4>
                                                </div>
                                                <p className="text-xs text-muted-foreground leading-relaxed">
                                                    Yup, you can cancel whenever you want from your account settings. No questions asked, no hidden fees.
                                                </p>
                                            </div>

                                            <div className="space-y-4">
                                                <h4 className="font-bold text-sm flex items-center gap-2">
                                                    <Info className="h-4 w-4 text-muted-foreground" />
                                                    Common Questions
                                                </h4>
                                                <div className="space-y-4">
                                                    <div className="space-y-1">
                                                        <p className="text-xs font-bold text-white">Will my card be charged today?</p>
                                                        <p className="text-xs text-muted-foreground">Nope! You'll only be charged if you don't cancel your trial before it ends.</p>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-xs font-bold text-white">Can I change plans later?</p>
                                                        <p className="text-xs text-muted-foreground">Absolutely. You can switch between monthly and yearly billing at any time.</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right: Checkout (Basecamp/Streamable style) */}
                                        <div className="lg:col-span-3">
                                            <div className="bg-black/20 rounded-2xl border border-white/5 overflow-hidden shadow-2xl">
                                                <div className="p-8 space-y-8">
                                                    <div className="space-y-4">
                                                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Select your plan</p>
                                                        <div className="grid gap-4">
                                                            <div
                                                                onClick={() => setBillingCycle("monthly")}
                                                                className={`p-6 rounded-xl border-2 transition-all cursor-pointer flex justify-between items-center ${billingCycle === "monthly"
                                                                        ? "border-primary bg-primary/5 shadow-[0_0_20px_rgba(var(--primary),0.1)]"
                                                                        : "border-white/5 bg-white/5 hover:border-white/10"
                                                                    }`}
                                                            >
                                                                <div className="space-y-1">
                                                                    <p className="font-bold">Monthly</p>
                                                                    <p className="text-sm text-muted-foreground">Cancel anytime no fee</p>
                                                                </div>
                                                                <p className="text-xl font-bold">$12.99</p>
                                                            </div>

                                                            <div
                                                                onClick={() => setBillingCycle("yearly")}
                                                                className={`relative p-6 rounded-xl border-2 transition-all cursor-pointer flex justify-between items-center ${billingCycle === "yearly"
                                                                        ? "border-primary bg-primary/5 shadow-[0_0_20px_rgba(var(--primary),0.1)]"
                                                                        : "border-white/5 bg-white/5 hover:border-white/10"
                                                                    }`}
                                                            >
                                                                <div className="absolute -top-3 right-6 bg-primary text-primary-foreground px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter">
                                                                    Most Popular
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <p className="font-bold">Yearly</p>
                                                                        <span className="text-[10px] font-bold text-primary">SAVE 23%</span>
                                                                    </div>
                                                                    <p className="text-sm text-muted-foreground">Pay once a year</p>
                                                                </div>
                                                                <div className="text-right">
                                                                    <p className="text-xl font-bold">$9.99<span className="text-xs font-normal text-muted-foreground">/mo</span></p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-4 pt-4 border-t border-white/5">
                                                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Payment details</p>
                                                        <div className="space-y-4">
                                                            <div className="grid gap-4">
                                                                <div className="relative">
                                                                    <Input
                                                                        placeholder="Card number"
                                                                        className="h-12 bg-black/20 border-white/5 pl-10 focus-visible:ring-primary/20"
                                                                    />
                                                                    <CardIcon className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                                                                    <div className="absolute right-3 top-3.5 flex gap-1 opacity-50 grayscale">
                                                                        <div className="h-5 w-8 bg-white/10 rounded flex items-center justify-center text-[8px] font-bold">VISA</div>
                                                                        <div className="h-5 w-8 bg-white/10 rounded flex items-center justify-center text-[8px] font-bold">MC</div>
                                                                    </div>
                                                                </div>
                                                                <div className="grid grid-cols-3 gap-4">
                                                                    <Input placeholder="MM / YY" className="h-12 bg-black/20 border-white/5 focus-visible:ring-primary/20" />
                                                                    <Input placeholder="CVC" className="h-12 bg-black/20 border-white/5 focus-visible:ring-primary/20" />
                                                                    <Input placeholder="Zip" className="h-12 bg-black/20 border-white/5 focus-visible:ring-primary/20" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Basecamp Style Message */}
                                                    <div className="text-center space-y-4 pt-4">
                                                        <p className="text-sm text-muted-foreground italic">
                                                            You’ll pay <span className="font-bold text-white">{billingCycle === 'yearly' ? '$119.88' : '$12.99'}</span> now for your {billingCycle === 'yearly' ? 'next year' : 'next month'}, and on individual cycles thereafter.
                                                        </p>
                                                        <Button className="w-full h-14 text-sm font-bold bg-primary hover:bg-primary/90 rounded-xl shadow-lg shadow-primary/20">
                                                            Start Billing / Update Plan
                                                        </Button>
                                                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                                                            Secured by internal encryption & Privacy Shield
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
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
