export default function BudgetLoading() {
  const Sk = ({ w, h, r = "10px" }: { w: string; h: string; r?: string }) => (
    <div style={{ width: w, height: h, borderRadius: r, background: "#f0f0f0", animation: "pulse 1.5s ease-in-out infinite" }} />
  )
  return (
    <div style={{ paddingBottom: 80 }}>
      <style>{"@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }"}</style>
      <Sk w="100%" h="44px" r="14px" />
      <div style={{ marginTop: 16, background: "#fff", borderRadius: 16, padding: 16, marginBottom: 16 }}>
        <Sk w="120px" h="12px" r="6px" />
      </div>
      {[0,1,2,3].map(i => (
        <div key={i} style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Sk w="44px" h="14px" r="6px" />
            <div style={{ flex: 1, background: "#fff", borderRadius: 12, border: "1px solid #f0f0f0", padding: "10px 12px" }}>
              <Sk w="80px" h="14px" r="6px" />
            </div>
            <Sk w="40px" h="22px" r="11px" />
          </div>
        </div>
      ))}
      <Sk w="100%" h="48px" r="16px" />
    </div>
  )
}
