import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useStorageConfig } from "@/hooks/useStorageConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Loader2,
  Cloud,
  HardDrive,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Users,
  Trash2,
  Key,
  ChevronLeft,
  Database,
  Clock
} from "lucide-react";
import { toast } from "sonner";
import { adminApi, User, BackupFile } from "@/lib/api";
import { formatDistance } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Section = "storage" | "users" | "backups";

export default function Admin() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { config, loading: configLoading, saving, updateConfig, testStorjConnection } = useStorageConfig();

  const [activeSection, setActiveSection] = useState<Section>("users");

  // Storage State
  const [useStorj, setUseStorj] = useState(false);
  const [accessKey, setAccessKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [bucket, setBucket] = useState("");
  const [endpoint, setEndpoint] = useState("https://gateway.storjshare.io");
  const [maxFileSize, setMaxFileSize] = useState(500);
  const [defaultStorageLimit, setDefaultStorageLimit] = useState(512);
  const [videoExpirationDays, setVideoExpirationDays] = useState(60);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);

  // Users State
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Password Dialog
  const [newPassword, setNewPassword] = useState("");
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);

  // Expiration Dialog
  const [newExpiration, setNewExpiration] = useState<string>("");
  const [isExpirationDialogOpen, setIsExpirationDialogOpen] = useState(false);

  // Quota Dialog
  const [newQuota, setNewQuota] = useState("");
  const [isQuotaDialogOpen, setIsQuotaDialogOpen] = useState(false);

  // Backup State
  const [backupConfig, setBackupConfig] = useState({ enabled: false, schedule: "0 2 * * *", retentionDays: 30 });
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [runningBackup, setRunningBackup] = useState(false);

  useEffect(() => {
    if (config) {
      setUseStorj(config.provider === "storj");
      setAccessKey(config.storj_access_key || "");
      setSecretKey(config.storj_secret_key || "");
      setBucket(config.storj_bucket || "");
      setEndpoint(config.storj_endpoint || "https://gateway.storjshare.io");
      setMaxFileSize(config.max_file_size_mb);
      setDefaultStorageLimit(config.default_storage_limit_mb || 512);
      setVideoExpirationDays(config.video_expiration_days ?? 60);
    }
  }, [config]);

  // Handle Hash Navigation
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash === "storage" || hash === "users" || hash === "backups") {
        setActiveSection(hash as Section);
      }
    };
    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  // Fetch users when section changes
  useEffect(() => {
    const loadData = async () => {
      if (activeSection === "users" && isAdmin) {
        await fetchUsers();
      }
      if (activeSection === "backups" && isAdmin) {
        await fetchBackups();
      }
    };
    loadData();
  }, [activeSection, isAdmin]);

  const fetchBackups = async () => {
    setLoadingBackups(true);
    try {
      const data = await adminApi.getBackupConfig();
      setBackupConfig({
        enabled: data.config.backup_enabled,
        schedule: data.config.backup_schedule || "0 2 * * *",
        retentionDays: data.config.backup_retention_days || 30
      });
      setBackups(data.files);
    } catch (error) {
      toast.error("Failed to load backup info");
    } finally {
      setLoadingBackups(false);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const data = await adminApi.getUsers();
      setUsers(data);
    } catch (error) {
      toast.error("Failed to load users");
    } finally {
      setLoadingUsers(false);
    }
  };

  // Redirect non-admins
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/");
      return;
    }
    if (!adminLoading && !isAdmin) {
      toast.error("Access denied. Admin only.");
      navigate("/");
    }
  }, [user, isAdmin, authLoading, adminLoading, navigate]);

  const handleStorageSave = async () => {
    const updates: Record<string, unknown> = {
      provider: useStorj ? "storj" : "local",
      max_file_size_mb: maxFileSize,
      default_storage_limit_mb: defaultStorageLimit,
      video_expiration_days: videoExpirationDays,
    };

    if (useStorj) {
      if (!accessKey || !secretKey || !bucket) {
        toast.error("All STORJ fields are required when STORJ is enabled");
        return;
      }
      updates.storj_access_key = accessKey;
      updates.storj_secret_key = secretKey;
      updates.storj_bucket = bucket;
      updates.storj_endpoint = endpoint;
    }

    const result = await updateConfig(updates);

    if (result.success) {
      toast.success("Storage configuration saved!");
    } else {
      toast.error(result.error || "Failed to save configuration");
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    const result = await testStorjConnection(accessKey, secretKey, bucket);
    setTestResult(result);
    setTesting(false);

    if (result.success) {
      toast.success("Connection test passed!");
    } else {
      toast.error(result.error || "Connection test failed");
    }
  };

  const handleDeleteUser = async (userToDelete: User) => {
    if (!confirm(`Are you sure you want to delete ${userToDelete.email}? This will delete ALL their videos and cannot be undone.`)) return;
    try {
      await adminApi.deleteUser(userToDelete.id);
      toast.success("User deleted successfully");
      fetchUsers();
    } catch (error) {
      toast.error("Failed to delete user");
    }
  };

  const openPasswordDialog = (userToEdit: User) => {
    setSelectedUser(userToEdit);
    setNewPassword("");
    setIsPasswordDialogOpen(true);
  };

  const handleChangePassword = async () => {
    if (!selectedUser || !newPassword) return;
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    try {
      await adminApi.updateUserPassword(selectedUser.id, newPassword);
      toast.success("Password updated successfully");
      setIsPasswordDialogOpen(false);
      setNewPassword("");
      setSelectedUser(null);
    } catch (error) {
      toast.error("Failed to update password");
    }
  };

  const openQuotaDialog = (userToEdit: User) => {
    setSelectedUser(userToEdit);
    // Convert bytes to MB for display
    setNewQuota(Math.round(userToEdit.storage_limit / (1024 * 1024)).toString());
    setIsQuotaDialogOpen(true);
  };

  const handleUpdateQuota = async () => {
    if (!selectedUser || !newQuota) return;
    const quotaMb = parseInt(newQuota);
    if (isNaN(quotaMb) || quotaMb < 0) {
      toast.error("Invalid quota value");
      return;
    }

    try {
      const quotaBytes = quotaMb * 1024 * 1024;
      await adminApi.updateUserQuota(selectedUser.id, quotaBytes);
      toast.success("User quota updated");
      setIsQuotaDialogOpen(false);
      setNewQuota("");
      setSelectedUser(null);
      fetchUsers();
    } catch (error) {
      toast.error("Failed to update user quota");
    }
  };

  const openExpirationDialog = (userToEdit: User) => {
    setSelectedUser(userToEdit);
    // Show empty for "use default", otherwise show the value (0 = never)
    setNewExpiration(userToEdit.video_expiration_days !== null && userToEdit.video_expiration_days !== undefined 
      ? userToEdit.video_expiration_days.toString() 
      : "");
    setIsExpirationDialogOpen(true);
  };

  const handleUpdateExpiration = async () => {
    if (!selectedUser) return;
    
    // Empty string = use global default (null), otherwise parse as number
    const expirationValue = newExpiration.trim() === "" ? null : parseInt(newExpiration);
    
    if (expirationValue !== null && (isNaN(expirationValue) || expirationValue < 0)) {
      toast.error("Invalid expiration value. Use empty for default, 0 for never, or days.");
      return;
    }

    try {
      await adminApi.updateUserExpiration(selectedUser.id, expirationValue);
      toast.success(expirationValue === null ? "Using global default" : expirationValue === 0 ? "Videos will never expire" : `Videos expire after ${expirationValue} days`);
      setIsExpirationDialogOpen(false);
      setNewExpiration("");
      setSelectedUser(null);
      fetchUsers();
    } catch (error) {
      toast.error("Failed to update expiration");
    }
  };

  const handleBackupSave = async () => {
    try {
      await adminApi.updateBackupConfig(backupConfig);
      toast.success("Backup configuration saved");
    } catch (error) {
      toast.error("Failed to save backup config");
    }
  };

  const handleRunBackup = async () => {
    setRunningBackup(true);
    try {
      const result = await adminApi.runBackup();
      if (result.success) {
        toast.success(`Backup created: ${result.file}`);
        fetchBackups();
      } else {
        toast.error("Backup failed");
      }
    } catch (error) {
      toast.error("Backup failed to start");
    } finally {
      setRunningBackup(false);
    }
  };

  const handleClearCache = async () => {
    try {
      const result = await adminApi.clearCache();
      if (result.success) {
        toast.success("Cache cleared successfully");
      } else {
        toast.error("Failed to clear cache");
      }
    } catch (error) {
      toast.error("Failed to clear cache");
    }
  };

  if (authLoading || adminLoading || configLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  // Helper to format bytes
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8">
        <Link to="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-6 w-fit">
          <ChevronLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>

        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar */}
          <aside className="w-full md:w-64 space-y-1">
            <button
              onClick={() => {
                setActiveSection("storage");
                window.location.hash = "storage";
              }}
              className={`flex w-full items-center gap-3 px-3 py-2 text-sm font-medium rounded-md ${activeSection === "storage" ? "bg-secondary text-primary" : "hover:bg-secondary/50"
                }`}
            >
              <HardDrive className="h-4 w-4" />
              Storage Settings
            </button>
            <button
              onClick={() => {
                setActiveSection("users");
                window.location.hash = "users";
              }}
              className={`flex w-full items-center gap-3 px-3 py-2 text-sm font-medium rounded-md ${activeSection === "users" ? "bg-secondary text-primary" : "hover:bg-secondary/50"
                }`}
            >
              <Users className="h-4 w-4" />
              User Management
            </button>
            <button
              onClick={() => {
                setActiveSection("backups");
                window.location.hash = "backups";
              }}
              className={`flex w-full items-center gap-3 px-3 py-2 text-sm font-medium rounded-md ${activeSection === "backups" ? "bg-secondary text-primary" : "hover:bg-secondary/50"
                }`}
            >
              <Database className="h-4 w-4" />
              Backups
            </button>
          </aside>

          {/* Content */}
          <div className="flex-1">
            {activeSection === "storage" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Storage Provider Card */}
                <Card className="bg-[#1d1d1f] border-white/10">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      {useStorj ? <Cloud className="h-5 w-5" /> : <HardDrive className="h-5 w-5" />}
                      Storage Provider
                    </CardTitle>
                    <CardDescription>
                      Choose where to store uploaded videos. STORJ provides decentralized cloud storage.
                      Local storage is used as fallback.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-white">Use STORJ S3</Label>
                        <p className="text-sm text-muted-foreground">
                          Enable STORJ for decentralized storage (falls back to local storage if unavailable)
                        </p>
                      </div>
                      <Switch checked={useStorj} onCheckedChange={setUseStorj} />
                    </div>

                    {useStorj && (
                      <div className="space-y-4 pt-4 border-t border-white/10">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="accessKey" className="text-white">
                              Access Key
                            </Label>
                            <Input
                              id="accessKey"
                              value={accessKey}
                              onChange={(e) => setAccessKey(e.target.value)}
                              placeholder="STORJ access key"
                              className="bg-black/20 border-white/10"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="secretKey" className="text-white">
                              Secret Key
                            </Label>
                            <div className="relative">
                              <Input
                                id="secretKey"
                                type={showSecretKey ? "text" : "password"}
                                value={secretKey}
                                onChange={(e) => setSecretKey(e.target.value)}
                                placeholder="STORJ secret key"
                                className="bg-black/20 border-white/10 pr-10"
                              />
                              <button
                                type="button"
                                onClick={() => setShowSecretKey(!showSecretKey)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
                              >
                                {showSecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="bucket" className="text-white">
                              Bucket Name
                            </Label>
                            <Input
                              id="bucket"
                              value={bucket}
                              onChange={(e) => setBucket(e.target.value)}
                              placeholder="my-video-bucket"
                              className="bg-black/20 border-white/10"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="endpoint" className="text-white">
                              Endpoint
                            </Label>
                            <Input
                              id="endpoint"
                              value={endpoint}
                              onChange={(e) => setEndpoint(e.target.value)}
                              placeholder="https://gateway.storjshare.io"
                              className="bg-black/20 border-white/10"
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <Button
                            variant="outline"
                            onClick={handleTestConnection}
                            disabled={testing || !accessKey || !secretKey || !bucket}
                            className="border-white/20"
                          >
                            {testing ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Testing...
                              </>
                            ) : (
                              "Test Connection"
                            )}
                          </Button>

                          {testResult && (
                            <div className="flex items-center gap-2">
                              {testResult.success ? (
                                <>
                                  <CheckCircle className="h-5 w-5 text-green-500" />
                                  <span className="text-green-500 text-sm">Connection successful</span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="h-5 w-5 text-red-500" />
                                  <span className="text-red-500 text-sm">{testResult.error}</span>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Upload Settings Card */}
                <Card className="bg-[#1d1d1f] border-white/10">
                  <CardHeader>
                    <CardTitle className="text-white">Upload Settings</CardTitle>
                    <CardDescription>Configure file upload limits and restrictions</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="maxFileSize" className="text-white">
                          Max Single File Size (MB)
                        </Label>
                        <Input
                          id="maxFileSize"
                          type="number"
                          min={1}
                          max={50000}
                          value={maxFileSize}
                          onChange={(e) => setMaxFileSize(Number(e.target.value))}
                          className="bg-black/20 border-white/10 w-48"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="defaultStorageLimit" className="text-white">
                          Default User Storage Limit (MB)
                        </Label>
                        <Input
                          id="defaultStorageLimit"
                          type="number"
                          min={1}
                          value={defaultStorageLimit}
                          onChange={(e) => setDefaultStorageLimit(Number(e.target.value))}
                          className="bg-black/20 border-white/10 w-48"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="videoExpirationDays" className="text-white">
                          Video Expiration (Days)
                        </Label>
                        <Input
                          id="videoExpirationDays"
                          type="number"
                          min={0}
                          placeholder="0 = never expire"
                          value={videoExpirationDays}
                          onChange={(e) => setVideoExpirationDays(Number(e.target.value))}
                          className="bg-black/20 border-white/10 w-48"
                        />
                        <p className="text-xs text-white/50">
                          Videos will auto-delete after this many days. Set to 0 for no expiration.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-white">Allowed File Types</Label>
                      <div className="flex flex-wrap gap-2">
                        {config?.allowed_types?.map((type) => (
                          <span
                            key={type}
                            className="px-3 py-1 bg-primary/20 text-primary rounded-full text-sm"
                          >
                            {type.split("/")[1]}
                          </span>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-[#1d1d1f] border-white/10">
                  <CardHeader>
                    <CardTitle className="text-white">System Maintenance</CardTitle>
                    <CardDescription>Perform system maintenance tasks.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-white">Clear System Cache</Label>
                        <p className="text-sm text-muted-foreground">
                          Clear the server-side cache for configuration and user roles.
                          Useful if you made changes directly to the database.
                        </p>
                      </div>
                      <Button variant="outline" onClick={handleClearCache} className="border-white/20 hover:bg-white/10 hover:text-white text-white">
                        Clear Cache
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Save Button */}
                <div className="flex justify-end">
                  <Button onClick={handleStorageSave} disabled={saving} className="min-w-32">
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                </div>
              </div>
            )}

            {activeSection === "users" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card className="bg-[#1d1d1f] border-white/10">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <Users className="h-5 w-5" />
                      Users
                    </CardTitle>
                    <CardDescription>
                      Manage registered users, reset passwords, and remove accounts.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loadingUsers ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : users.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">No users found.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="border-white/10 hover:bg-white/5">
                            <TableHead className="text-muted-foreground">Email</TableHead>
                            <TableHead className="text-muted-foreground">Joined</TableHead>
                            <TableHead className="text-muted-foreground">Storage</TableHead>
                            <TableHead className="text-muted-foreground">Roles</TableHead>
                            <TableHead className="text-right text-muted-foreground">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {users.map((u) => (
                            <TableRow key={u.id} className="border-white/10 hover:bg-white/5">
                              <TableCell className="font-medium text-white">
                                {u.email}
                                {u.id === user?.id && <span className="ml-2 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">You</span>}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {formatDistance(new Date(u.created_at), new Date(), { addSuffix: true })}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {formatBytes(u.storage_used)} / {formatBytes(u.storage_limit)}
                                <div className="w-24 h-1.5 bg-white/10 rounded-full mt-1 overflow-hidden">
                                  <div
                                    className="h-full bg-primary"
                                    style={{ width: `${Math.min(100, (u.storage_used / u.storage_limit) * 100)}%` }}
                                  />
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {u.roles.join(", ")}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    title="Edit Quota"
                                    className="hover:bg-white/10 hover:text-white"
                                    onClick={() => openQuotaDialog(u)}
                                  >
                                    <Database className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    title={`Video Expiration (${u.video_expiration_days === null ? 'default' : u.video_expiration_days === 0 ? 'never' : u.video_expiration_days + 'd'})`}
                                    className="hover:bg-white/10 hover:text-white"
                                    onClick={() => openExpirationDialog(u)}
                                  >
                                    <Clock className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    title="Change Password"
                                    className="hover:bg-white/10 hover:text-white"
                                    onClick={() => openPasswordDialog(u)}
                                  >
                                    <Key className="h-4 w-4" />
                                  </Button>
                                  {u.id !== user?.id && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      title="Delete User"
                                      className="hover:bg-red-500/20 hover:text-red-500 text-red-400"
                                      onClick={() => handleDeleteUser(u)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {activeSection === "backups" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card className="bg-[#1d1d1f] border-white/10">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      Automated Backups
                    </CardTitle>
                    <CardDescription>
                      Configure automated database backups using <code className="bg-black/30 px-1 rounded">pg_dump</code>.
                      Backups are stored in <code className="bg-black/30 px-1 rounded">server/backups</code>.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-white">Enable Automated Backups</Label>
                        <p className="text-sm text-muted-foreground">Run backups automatically on a schedule</p>
                      </div>
                      <Switch
                        checked={backupConfig.enabled}
                        onCheckedChange={(checked) => setBackupConfig({ ...backupConfig, enabled: checked })}
                      />
                    </div>

                    {backupConfig.enabled && (
                      <div className="grid gap-4 md:grid-cols-2 pt-4 border-t border-white/10">
                        <div className="space-y-2">
                          <Label className="text-white">Cron Schedule</Label>
                          <Input
                            value={backupConfig.schedule}
                            onChange={(e) => setBackupConfig({ ...backupConfig, schedule: e.target.value })}
                            placeholder="0 2 * * *"
                            className="bg-black/20 border-white/10"
                          />
                          <p className="text-xs text-muted-foreground">Default: 0 2 * * * (2 AM daily)</p>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-white">Retention (Days)</Label>
                          <Input
                            type="number"
                            value={backupConfig.retentionDays}
                            onChange={(e) => setBackupConfig({ ...backupConfig, retentionDays: parseInt(e.target.value) })}
                            className="bg-black/20 border-white/10"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between pt-4">
                      <Button variant="outline" onClick={handleRunBackup} disabled={runningBackup} className="border-white/20 text-white hover:bg-white/10">
                        {runningBackup ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Database className="h-4 w-4 mr-2" />}
                        Run Backup Now
                      </Button>
                      <Button onClick={handleBackupSave}>Save Configuration</Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-[#1d1d1f] border-white/10">
                  <CardHeader>
                    <CardTitle className="text-white">Recent Backups</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loadingBackups ? (
                      <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
                    ) : backups.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">No backups found.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="border-white/10">
                            <TableHead className="text-muted-foreground">Filename</TableHead>
                            <TableHead className="text-muted-foreground">Date</TableHead>
                            <TableHead className="text-muted-foreground text-right">Size</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {backups.map((f) => (
                            <TableRow key={f.name} className="border-white/10 hover:bg-white/5">
                              <TableCell className="font-mono text-xs text-white">{f.name}</TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {new Date(f.date).toLocaleString()}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-right text-sm">
                                {(f.size / 1024 / 1024).toFixed(2)} MB
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </main>

      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent className="bg-[#1d1d1f] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter a new password for {selectedUser?.email}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="bg-black/20 border-white/10"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPasswordDialogOpen(false)} className="border-white/10 hover:bg-white/5 hover:text-white">Cancel</Button>
            <Button onClick={handleChangePassword}>Save Password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isQuotaDialogOpen} onOpenChange={setIsQuotaDialogOpen}>
        <DialogContent className="bg-[#1d1d1f] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Edit Storage Quota</DialogTitle>
            <DialogDescription>
              Set a custom storage limit for {selectedUser?.email}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="quota">Storage Limit (MB)</Label>
              <Input
                id="quota"
                type="number"
                min={0}
                value={newQuota}
                onChange={(e) => setNewQuota(e.target.value)}
                placeholder="e.g. 1024 for 1GB"
                className="bg-black/20 border-white/10"
              />
              <p className="text-xs text-muted-foreground">
                Enter 0 to disable uploads for this user.
                1024 MB = 1 GB.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsQuotaDialogOpen(false)} className="border-white/10 hover:bg-white/5 hover:text-white">Cancel</Button>
            <Button onClick={handleUpdateQuota}>Save Limit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isExpirationDialogOpen} onOpenChange={setIsExpirationDialogOpen}>
        <DialogContent className="bg-[#1d1d1f] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Edit Video Expiration</DialogTitle>
            <DialogDescription>
              Set custom video expiration for {selectedUser?.email}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="expiration">Expiration (Days)</Label>
              <Input
                id="expiration"
                type="number"
                min={0}
                value={newExpiration}
                onChange={(e) => setNewExpiration(e.target.value)}
                placeholder="Empty = global default"
                className="bg-black/20 border-white/10"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to use global default ({videoExpirationDays} days).<br/>
                Enter 0 for videos that never expire.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExpirationDialogOpen(false)} className="border-white/10 hover:bg-white/5 hover:text-white">Cancel</Button>
            <Button onClick={handleUpdateExpiration}>Save Expiration</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
