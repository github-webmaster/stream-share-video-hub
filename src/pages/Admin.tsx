import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useStorageConfig } from "@/hooks/useStorageConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Loader2, Shield, Cloud, HardDrive, CheckCircle, XCircle, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export default function Admin() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { config, loading: configLoading, saving, updateConfig, testStorjConnection } = useStorageConfig();

  const [useStorj, setUseStorj] = useState(false);
  const [accessKey, setAccessKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [bucket, setBucket] = useState("");
  const [endpoint, setEndpoint] = useState("https://gateway.storjshare.io");
  const [maxFileSize, setMaxFileSize] = useState(500);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);

  useEffect(() => {
    if (config) {
      setUseStorj(config.provider === "storj");
      setAccessKey(config.storj_access_key || "");
      setSecretKey(config.storj_secret_key || "");
      setBucket(config.storj_bucket || "");
      setEndpoint(config.storj_endpoint || "https://gateway.storjshare.io");
      setMaxFileSize(config.max_file_size_mb);
    }
  }, [config]);

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

  const handleSave = async () => {
    const updates: Record<string, unknown> = {
      provider: useStorj ? "storj" : "local",
      max_file_size_mb: maxFileSize,
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

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
          </div>
          <p className="text-muted-foreground">Configure storage settings and system preferences</p>
        </div>

        <div className="space-y-6">
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
              <div className="space-y-2">
                <Label htmlFor="maxFileSize" className="text-white">
                  Maximum File Size (MB)
                </Label>
                <Input
                  id="maxFileSize"
                  type="number"
                  min={1}
                  max={5000}
                  value={maxFileSize}
                  onChange={(e) => setMaxFileSize(Number(e.target.value))}
                  className="bg-black/20 border-white/10 w-32"
                />
                <p className="text-sm text-muted-foreground">
                  Maximum size for a single video upload
                </p>
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

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} className="min-w-32">
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
      </main>
    </div>
  );
}
