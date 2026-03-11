import { useState, useRef } from "react";
import { updateCompanyConfig, uploadCompanyLogo } from "../api/endpoints.js";
import { useCompany } from "../contexts/CompanyContext.js";

const CURRENCIES = ["GBP", "USD", "EUR", "AUD"];
const TIMEZONES = [
  "Europe/London", "America/New_York", "America/Chicago", "America/Denver",
  "America/Los_Angeles", "Europe/Paris", "Europe/Berlin", "Asia/Tokyo",
  "Australia/Sydney",
];

export function CompanySettingsView() {
  const { config, refresh } = useCompany();
  const [companyName, setCompanyName] = useState(config?.company_name ?? "");
  const [currency, setCurrency] = useState(config?.currency ?? "GBP");
  const [timezone, setTimezone] = useState(config?.timezone ?? "Europe/London");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateCompanyConfig({ company_name: companyName, currency, timezone });
      await refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert("Max 2MB"); return; }
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleUploadLogo() {
    if (!logoPreview) return;
    setUploadingLogo(true);
    try {
      const mimeType = logoPreview.split(";")[0]?.split(":")[1] ?? "image/jpeg";
      await uploadCompanyLogo(logoPreview, mimeType);
      await refresh();
      setLogoPreview(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? "Upload failed";
      alert(msg);
    } finally {
      setUploadingLogo(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto py-8 px-4 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Company Settings</h1>

      {/* Logo */}
      <div className="bg-white border rounded-lg p-6 space-y-4">
        <h2 className="font-semibold text-gray-700">Company Logo</h2>
        <div className="flex items-center gap-4">
          {(logoPreview || config?.logo_url) ? (
            <img
              src={logoPreview ?? config!.logo_url!}
              alt="Company logo"
              className="w-20 h-20 rounded border object-contain"
            />
          ) : (
            <div className="w-20 h-20 rounded border bg-gray-100 flex items-center justify-center text-3xl font-bold text-gray-400">
              {(config?.company_name ?? "?")[0]}
            </div>
          )}
          <div className="space-y-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="bg-gray-100 hover:bg-gray-200 border text-gray-700 px-3 py-2 rounded text-sm"
            >
              Choose file
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            {logoPreview && (
              <button
                onClick={handleUploadLogo}
                disabled={uploadingLogo}
                className="ml-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded text-sm disabled:opacity-50"
              >
                {uploadingLogo ? "Uploading…" : "Upload Logo"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Settings form */}
      <form onSubmit={handleSave} className="bg-white border rounded-lg p-6 space-y-4">
        <h2 className="font-semibold text-gray-700">Branding & Locale</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {TIMEZONES.map((tz) => <option key={tz}>{tz}</option>)}
          </select>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium px-6 py-2 rounded text-sm"
        >
          {saving ? "Saving…" : saved ? "✓ Saved" : "Save Settings"}
        </button>
      </form>
    </div>
  );
}
