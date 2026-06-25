export default function CategoryLoading() {
  const Sk = ({ w, h, r = "10px" }: { w: string; h: string; r?: string }) => (
    <div style={{ width: w, height: h, borderRadius: r, background: "#f0f0f0", animation: "pulse 1.5s ease-in-out infinite" }} />
  )
  return (
    <div style={{ paddingBottom: 80 }}>
      <style>{"@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }"}</style>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <Sk w="80px" h="24px" r="6px" />
        <Sk w="60px" h="32px" r="10px" />
      </div>
      <div style={{ background: "#fff", borderRadius: 16, overflow: "hidden" }}>
        {[0,1,2,3,4].map(i => (
          <div key={i} style={{ display: "flex", alignItems: "center", padding: "14px 16px", borderBottom: i < 4 ? "1px solid #f9f9f9" : "none", gap: 12 }}>
            <Sk w="32px" h="32px" r="50%" />
            <div style={{ flex: 1 }}><Sk w="80px" h="14px" r="6px" /></div>
            <Sk w="24px" h="24px" r="6px" />
          </div>
        ))}
      </div>
    </div>
  )
}
