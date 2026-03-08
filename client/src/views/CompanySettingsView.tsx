/**
 * Company Settings View — Phase 9
 *
 * Manager can:
 *   - Update company name
 *   - Upload company logo (base64)
 *   - Change primary colour (preview only)
 */

import { useState, useEffect, useRef } from "react";
import { fetchCompanyConfig, updateCompanyConfig, uploadCompanyLogo } from "../api/endpoints.js";
import type { CompanyConfig } from "../api/types.js";
import { useToast } from "../contexts/ToastContext.js";

export function CompanySettingsView() {
  const { showToast } = useToast();
  const [config, setConfig] = useState<CompanyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#4f46e5");
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchCompanyConfig()
      .then((c) => {
        setConfig(c);
        setCompanyName(c.company_name);
        setPrimaryColor(c.primary_color ?? "#4f46e5");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await updateCompanyConfig({ company_name: companyName, primary_color: primaryColor });
      setConfig(updated);
      showToast("Company settings saved", "success");
    } catch {
      showToast("Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const dataUrl = ev.target?.result as string;
        const base64 = dataUrl.split(",")[1];
        const mime_type = file.type || "image/png";
        const updated = await uploadCompanyLogo(base64, mime_type);
        setConfig(updated);
        showToast("Logo uploaded", "success");
        setUploadingLogo(false);
      };
      reader.readAsDataURL(file);
    } catch {
      showToast("Failed to upload logo", "error");
      setUploadingLogo(false);
    }
    e.target.value = "";
  }

  if (loading) {
    return <p className="text-sm text-slate-400 text-center py-8">Loading…</p>;
  }

  const inputCls =
    "w-full h-10 px-4 rounded-xl border border-slate-200 text-sm text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:bg-white transition-all";

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Company Settings</h2>
        <p className="text-xs text-slate-400 mt-0.5">Branding shown across both portals</p>
      </div>

      {/* Logo section */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        <p className="text-sm font-bold text-slate-700">Logo</p>
        <div className="flex items-center gap-4">
          {config?.logo_url ? (
            <img src={config.logo_url} alt="Company logo" className="w-16 h-16 rounded-xl object-contain border border-slate-100" />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold">
              {companyName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="space-y-2">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploadingLogo}
              className="h-9 px-4 rounded-xl bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-xs font-semibold disabled:opacity-50 transition-all"
            >
              {uploadingLogo ? "Uploading…" : "Upload Logo"}
            </button>
            <p className="text-xs text-slate-400">PNG or JPG, max 2MB recommended</p>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
          </div>
        </div>
      </div>

      {/* Name + colour */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        <p className="text-sm font-bold text-slate-700">Branding</p>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Company Name</label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className={inputCls}
            placeholder="ScheduleMgr"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Primary Colour</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer p-0.5"
            />
            <input
              type="text"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="flex-1 h-10 px-3 rounded-xl border border-slate-200 text-sm text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono"
              placeholder="#4f46e5"
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !companyName.trim()}
          className="w-full h-10 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all shadow-sm"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>

      {/* Preview */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3">
        <p className="text-sm font-bold text-slate-700">Preview</p>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
          {config?.logo_url ? (
            <img src={config.logo_url} alt={companyName} className="w-10 h-10 rounded-lg object-contain" />
          ) : (
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold"
              style={{ background: primaryColor }}
            >
              {companyName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-bold text-slate-900">{companyName || "Company Name"}</p>
            <p className="text-xs text-slate-400">Manager Portal</p>
          </div>
        </div>
      </div>
    </div>
  );
}
