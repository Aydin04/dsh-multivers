// MULTIVERS Web UI Client Plugin for DeepSeek Harness
// Dedicated "🪐 MULTIVERS" Settings Tab and Dashboard

window.__ModuleLoader__.load({
  id: "@aydin04/dsh-multivers",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    let react = require("react");
    const h = react.createElement;
    const { useState, useEffect, useCallback } = react;

    const name = "@aydin04/dsh-multivers";
    const inject = ["slots"];

    const TOKENS = {
      ink: "var(--dsw-alias-label-primary, #e5e7eb)",
      muted: "var(--dsw-alias-label-tertiary, #9ca3af)",
      dim: "var(--dsw-alias-label-dimmed, #6b7280)",
      border: "var(--dsw-alias-border-l2, rgba(128,128,128,.25))",
      panel: "var(--dsw-alias-bg-layer-3, rgba(255,255,255,.035))",
      panel2: "var(--dsw-alias-bg-layer-2, rgba(255,255,255,.06))",
      accent: "var(--dsw-alias-brand-primary, #4d9cff)",
      success: "#3fb950",
      danger: "var(--dsw-alias-state-error-primary, #ef6b73)"
    };

    const CONTAINER_STYLE = {
      width: "100%",
      maxWidth: "880px",
      display: "flex",
      flexDirection: "column",
      gap: "18px",
      color: TOKENS.ink,
      fontFamily: "inherit",
      padding: "8px 0"
    };

    const CARD_STYLE = {
      border: "1px solid " + TOKENS.border,
      borderRadius: "14px",
      padding: "16px 20px",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      background: TOKENS.panel,
      boxShadow: "0 2px 10px rgba(0,0,0,.06)"
    };

    const ROW_STYLE = {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "16px",
      flexWrap: "wrap"
    };

    const BTN = (bg) => ({
      padding: "9px 18px",
      borderRadius: "9px",
      border: "none",
      cursor: "pointer",
      fontSize: "13px",
      fontWeight: 600,
      background: bg,
      color: "#fff",
      transition: "opacity .15s"
    });

    const INPUT_NUM = {
      width: "90px",
      padding: "7px 10px",
      fontSize: "13px",
      background: TOKENS.panel2,
      color: TOKENS.ink,
      border: "1px solid " + TOKENS.border,
      borderRadius: "8px",
      outline: "none"
    };

    function Switch({ checked, onChange }) {
      return h("button", {
        type: "button",
        onClick: () => onChange(!checked),
        style: {
          position: "relative",
          width: "44px",
          height: "24px",
          borderRadius: "999px",
          border: "none",
          cursor: "pointer",
          background: checked ? TOKENS.accent : "rgba(128,128,128,.3)",
          transition: "background .2s",
          padding: 0,
          flexShrink: 0
        }
      }, h("span", {
        style: {
          position: "absolute",
          top: "3px",
          left: checked ? "23px" : "3px",
          width: "18px",
          height: "18px",
          borderRadius: "50%",
          background: "#fff",
          transition: "left .2s",
          boxShadow: "0 1px 3px rgba(0,0,0,.2)"
        }
      }));
    }

    function MultiversDashboard() {
      const [config, setConfig] = useState({
        enabled: true,
        enableSessionContextDigest: true,
        slidingWindowMessages: 4,
        truncateToolResults: true,
        maxToolResultChars: 1500,
        smartThrottleMs: 1200,
        flatlineDietEnabled: true,
        maxDigestLengthChars: 1200
      });
      const [saving, setSaving] = useState(false);
      const [notice, setNotice] = useState({ kind: "idle", text: "" });

      const fetchConfig = useCallback(() => {
        fetch("/api/multivers/config", { cache: "no-store" })
          .then((r) => r.json())
          .then((d) => {
            if (d.ok && d.config) setConfig(d.config);
          })
          .catch((e) => console.log("Multivers note:", e.message));
      }, []);

      useEffect(() => {
        fetchConfig();
      }, [fetchConfig]);

      const save = useCallback(() => {
        setSaving(true);
        setNotice({ kind: "idle", text: "" });
        fetch("/api/multivers/config", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(config)
        })
          .then((r) => r.json())
          .then((d) => {
            if (d.ok) {
              setConfig(d.config);
              setNotice({ kind: "ok", text: "Pengaturan MULTIVERS berhasil disimpan!" });
            } else {
              setNotice({ kind: "error", text: "Gagal menyimpan: " + (d.error || "") });
            }
          })
          .catch((e) => setNotice({ kind: "error", text: "Error: " + e.message }))
          .finally(() => setSaving(false));
      }, [config]);

      const update = (key, val) => {
        setConfig((prev) => ({ ...prev, [key]: val }));
      };

      return h("div", { style: CONTAINER_STYLE },
        // Header
        h("div", { style: { paddingBottom: "6px", borderBottom: "1px solid " + TOKENS.border } },
          h("div", { style: { display: "flex", alignItems: "center", gap: "10px" } },
            h("h2", { style: { margin: 0, fontSize: "22px", fontWeight: 700, letterSpacing: "-.02em" } }, "🪐 MULTIVERS Engine"),
            h("span", {
              style: {
                background: config.enabled ? "rgba(63, 185, 80, 0.15)" : "rgba(239, 107, 115, 0.15)",
                color: config.enabled ? TOKENS.success : TOKENS.danger,
                border: "1px solid " + (config.enabled ? "rgba(63, 185, 80, 0.3)" : "rgba(239, 107, 115, 0.3)"),
                borderRadius: "999px",
                padding: "2px 10px",
                fontSize: "12px",
                fontWeight: 600
              }
            }, config.enabled ? "Active" : "Disabled")
          ),
          h("p", { style: { margin: "6px 0 10px", color: TOKENS.muted, fontSize: "13px", lineHeight: 1.5 } },
            "Zero-Bloat Payload Diet, Session Context Synthesizer (Pesan, Command & Sesi), Rolling Window, dan Anti-429 Rate Limiter."
          )
        ),

        // Master Switch
        h("div", { style: Object.assign({}, CARD_STYLE, { borderLeft: "4px solid " + TOKENS.accent }) },
          h("div", { style: ROW_STYLE },
            h("div", null,
              h("div", { style: { fontWeight: 600, fontSize: "15px" } }, "Aktifkan MULTIVERS Engine"),
              h("div", { style: { color: TOKENS.muted, fontSize: "12px", marginTop: "4px" } },
                "Master switch untuk seluruh sistem pemangkasan dan manajemen konteks."
              )
            ),
            h(Switch, { checked: config.enabled, onChange: (v) => update("enabled", v) })
          )
        ),

        // Feature 1: Session Context Synthesizer (Pesan, Perintah, State Sesi)
        h("div", { style: CARD_STYLE },
          h("div", { style: ROW_STYLE },
            h("div", { style: { maxWidth: "70%" } },
              h("div", { style: { fontWeight: 600, fontSize: "14px" } }, "🧠 Session Context Synthesizer (Konteks Pesan, Command & Sesi)"),
              h("div", { style: { color: TOKENS.muted, fontSize: "12px", marginTop: "4px" } },
                "Otomatis merangkum riwayat percakapan lampau, perintah (/slash command), dan aksi agent menjadi satu blok konteks padat ringkas."
              )
            ),
            h(Switch, { checked: config.enableSessionContextDigest, onChange: (v) => update("enableSessionContextDigest", v) })
          )
        ),

        // Feature 2: Rolling Context Window (N Pesan Terakhir)
        h("div", { style: CARD_STYLE },
          h("div", { style: ROW_STYLE },
            h("div", { style: { maxWidth: "70%" } },
              h("div", { style: { fontWeight: 600, fontSize: "14px" } }, "🛡️ Flatline Rolling Context Window (Kirim N Pesan Terakhir)"),
              h("div", { style: { color: TOKENS.muted, fontSize: "12px", marginTop: "4px" } },
                "Hanya mengirim pesan interaksi aktif terbaru ke LLM untuk menjaga payload tetap ramping tanpa membawa ratusan chat usang."
              )
            ),
            h(Switch, { checked: config.flatlineDietEnabled, onChange: (v) => update("flatlineDietEnabled", v) })
          ),
          config.flatlineDietEnabled ? h("div", {
            style: {
              display: "flex",
              alignItems: "center",
              gap: "12px",
              paddingTop: "10px",
              borderTop: "1px dashed " + TOKENS.border
            }
          },
            h("span", { style: { fontSize: "13px", color: TOKENS.muted } }, "Jumlah pesan riwayat aktif:"),
            h("input", {
              type: "number",
              min: 2,
              max: 20,
              value: config.slidingWindowMessages,
              onChange: (e) => update("slidingWindowMessages", parseInt(e.target.value) || 4),
              style: INPUT_NUM
            }),
            h("span", { style: { fontSize: "12px", color: TOKENS.dim } }, "Pesan (Default: 4)")
          ) : null
        ),

        // Feature 3: Tool Output Pruner
        h("div", { style: CARD_STYLE },
          h("div", { style: ROW_STYLE },
            h("div", { style: { maxWidth: "70%" } },
              h("div", { style: { fontWeight: 600, fontSize: "14px" } }, "✂️ Tool Output Auto-Pruner (PTC & Terminal Diet)"),
              h("div", { style: { color: TOKENS.muted, fontSize: "12px", marginTop: "4px" } },
                "Memangkas teks log terminal dan hasil tool PTC yang terlalu panjang di pesan riwayat chat."
              )
            ),
            h(Switch, { checked: config.truncateToolResults, onChange: (v) => update("truncateToolResults", v) })
          ),
          config.truncateToolResults ? h("div", {
            style: {
              display: "flex",
              alignItems: "center",
              gap: "12px",
              paddingTop: "10px",
              borderTop: "1px dashed " + TOKENS.border
            }
          },
            h("span", { style: { fontSize: "13px", color: TOKENS.muted } }, "Batas karakter per output:"),
            h("input", {
              type: "number",
              min: 500,
              max: 10000,
              step: 100,
              value: config.maxToolResultChars,
              onChange: (e) => update("maxToolResultChars", parseInt(e.target.value) || 1500),
              style: INPUT_NUM
            }),
            h("span", { style: { fontSize: "12px", color: TOKENS.dim } }, "Karakter (Default: 1500)")
          ) : null
        ),

        // Feature 4: Smart RPM Throttle
        h("div", { style: CARD_STYLE },
          h("div", { style: ROW_STYLE },
            h("div", { style: { maxWidth: "70%" } },
              h("div", { style: { fontWeight: 600, fontSize: "14px" } }, "⚡ Smart Request Rate Throttle (Anti-429 Limit Safe)"),
              h("div", { style: { color: TOKENS.muted, fontSize: "12px", marginTop: "4px" } },
                "Memberikan jeda waktu otomatis antar-request saat eksekusi beruntun agar API tidak memblokir RPM."
              )
            ),
            h("div", { style: { display: "flex", alignItems: "center", gap: "8px" } },
              h("input", {
                type: "number",
                min: 0,
                max: 5000,
                step: 100,
                value: config.smartThrottleMs,
                onChange: (e) => update("smartThrottleMs", parseInt(e.target.value) || 0),
                style: INPUT_NUM
              }),
              h("span", { style: { fontSize: "12px", color: TOKENS.dim } }, "ms")
            )
          )
        ),

        // Action Bar
        h("div", {
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: "8px",
            borderTop: "1px solid " + TOKENS.border
          }
        },
          h("div", null,
            notice.kind === "ok" ? h("span", { style: { fontSize: "13px", color: TOKENS.success, fontWeight: 600 } }, "✓ " + notice.text)
              : notice.kind === "error" ? h("span", { style: { fontSize: "13px", color: TOKENS.danger } }, "✗ " + notice.text)
              : null
          ),
          h("button", {
            style: Object.assign({}, BTN(TOKENS.accent), { opacity: saving ? 0.6 : 1 }),
            disabled: saving,
            onClick: save
          }, saving ? "Menyimpan…" : "Simpan Pengaturan")
        )
      );
    }

    function apply(ctx) {
      ctx.slots.inject("settings.section", () =>
        ctx.slots.register({
          name: "settings.section",
          id: "@aydin04/dsh-multivers",
          order: 40,
          label: () => "🪐 MULTIVERS",
        }, () => h(MultiversDashboard, null))
      );
    }

    exports.name = name;
    exports.inject = inject;
    exports.apply = apply;
    return module.exports;
  }
});