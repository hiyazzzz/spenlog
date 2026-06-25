export default function FixedLoading() {
  const Sk = ({ w, h, r = "10px" }: { w: string; h: string; r?: string }) => (
    <div style={{ width: w, height: h, borderRadius: r, background: "#f0f0f0", animation: "pulse 1.5s ease-in-out infinite" }} />
  )
  return (
    <div style={{ paddingBottom: 80 }}>
      <style>{"@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }"}</style>
      <Sk w="80px" h="24px" r="6px" />
      <div style={{ background: "#fff", borderRadius: 16, padding: 16, marginTop: 20, marginBottom: 16 }}>
        <Sk w="80px" h="12px" r="6px" />
        <div style={{ marginTop: 8 }}><Sk w="140px" h="28px" r="6px" /></div>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, background: "#fff", borderRadius: 14, border: "2px solid #f0f0f0", padding: "10px 8px", textAlign: "center" as const }}>
          <Sk w="50px" h="12px" r="6px" />
          <div style={{ margin: "6px auto 0" }}><Sk w="70px" h="16px" r="6px" /></div>
        </div>
        <div style={{ flex: 1, background: "#fff", borderRadius: 14, border: "2px solid #f0f0f0", padding: "10px 8px", textAlign: "center" as const }}>
          <Sk w="50px" h="12px" r="6px" />
          <div style={{ margin: "6px auto 0" }}><Sk w="70px" h="16px" r="6px" /></div>
        </div>
      </div>
      <div style={{ background: "#fff", borderRadius: 16, overflow: "hidden", marginBottom: 12 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: i < 2 ? "1px solid #f9f9f9" : "none" }}>
            <div>
              <Sk w="90px" h="14px" r="6px" />
              <div style={{ marginTop: 6 }}><Sk w="60px" h="11px" r="6px" /></div>
            </div>
            <Sk w="60px" h="16px" r="6px" />
          </div>
        ))}
      </div>
      <Sk w="100%" h="48px" r="16px" />
    </div>
  )
}
