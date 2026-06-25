export default function AssetsLoading() {
  const Sk = ({ w, h, r = "10px" }: { w: string; h: string; r?: string }) => (
    <div style={{ width: w, height: h, borderRadius: r, background: "#f0f0f0", animation: "pulse 1.5s ease-in-out infinite" }} />
  )
  return (
    <div style={{ paddingBottom: 80 }}>
      <style>{"@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }"}</style>
      <div style={{ background: "#fff", borderRadius: 20, padding: 20, marginBottom: 16 }}>
        <Sk w="80px" h="12px" r="6px" />
        <div style={{ marginTop: 8 }}><Sk w="160px" h="36px" r="6px" /></div>
        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><Sk w="60px" h="12px" r="6px" /><div style={{ marginTop: 6 }}><Sk w="90px" h="20px" r="6px" /></div></div>
          <div><Sk w="60px" h="12px" r="6px" /><div style={{ marginTop: 6 }}><Sk w="90px" h="20px" r="6px" /></div></div>
        </div>
      </div>
      {[0,1].map(s => (
        <div key={s} style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <Sk w="60px" h="16px" r="6px" />
            <Sk w="40px" h="16px" r="6px" />
          </div>
          {[0,1].map(i => (
            <div key={i} style={{ background: "#fff", borderRadius: 16, padding: 16, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <Sk w="80px" h="14px" r="6px" />
                <div style={{ marginTop: 6 }}><Sk w="55px" h="11px" r="6px" /></div>
              </div>
              <Sk w="80px" h="18px" r="6px" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
