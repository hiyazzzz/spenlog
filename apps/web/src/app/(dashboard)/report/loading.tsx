export default function ReportLoading() {
  const Sk = ({ w, h, r = "10px" }: { w: string; h: string; r?: string }) => (
    <div style={{ width: w, height: h, borderRadius: r, background: "#f0f0f0", animation: "pulse 1.5s ease-in-out infinite" }} />
  )
  return (
    <div style={{ paddingBottom: 80 }}>
      <style>{"@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }"}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <Sk w="60px" h="24px" r="6px" />
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Sk w="28px" h="28px" r="50%" />
          <Sk w="80px" h="16px" r="6px" />
          <Sk w="28px" h="28px" r="50%" />
        </div>
      </div>
      <div style={{ background: "#fff", borderRadius: 16, padding: 16, marginBottom: 12 }}>
        <Sk w="100px" h="12px" r="6px" />
        <div style={{ marginTop: 8 }}><Sk w="150px" h="32px" r="6px" /></div>
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}><Sk w="100%" h="12px" r="6px" /></div>
          <div style={{ flex: 1 }}><Sk w="100%" h="12px" r="6px" /></div>
        </div>
      </div>
      <div style={{ background: "#fff", borderRadius: 16, padding: 16, marginBottom: 12 }}>
        <Sk w="60px" h="12px" r="6px" />
        <div style={{ marginTop: 12, display: "flex", justifyContent: "center" }}>
          <Sk w="160px" h="160px" r="50%" />
        </div>
      </div>
      {[0,1,2,3].map(i => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", borderRadius: 12, padding: "12px 16px", marginBottom: 8 }}>
          <Sk w="80px" h="14px" r="6px" />
          <Sk w="70px" h="14px" r="6px" />
        </div>
      ))}
    </div>
  )
}
