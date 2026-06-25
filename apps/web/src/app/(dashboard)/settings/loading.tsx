export default function SettingsLoading() {
  const Sk = ({ w, h, r = "10px" }: { w: string; h: string; r?: string }) => (
    <div style={{ width: w, height: h, borderRadius: r, background: "#f0f0f0", animation: "pulse 1.5s ease-in-out infinite" }} />
  )
  return (
    <div style={{ paddingBottom: 80 }}>
      <style>{"@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }"}</style>
      <Sk w="60px" h="24px" r="6px" />
      <div style={{ background: "#fff", borderRadius: 20, padding: 16, marginTop: 20, marginBottom: 16 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 14, marginBottom: i < 3 ? 14 : 0, borderBottom: i < 3 ? "1px solid #f3f4f6" : "none" }}>
            <Sk w="70px" h="13px" r="6px" />
            <Sk w="90px" h="13px" r="6px" />
          </div>
        ))}
      </div>
      <div style={{ background: "#fff", borderRadius: 20, padding: 16, marginBottom: 16 }}>
        {[0,1].map(i => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: i < 1 ? 14 : 0, marginBottom: i < 1 ? 14 : 0, borderBottom: i < 1 ? "1px solid #f3f4f6" : "none" }}>
            <Sk w="80px" h="13px" r="6px" />
            <Sk w="36px" h="20px" r="10px" />
          </div>
        ))}
      </div>
      <Sk w="100%" h="44px" r="12px" />
    </div>
  )
}
