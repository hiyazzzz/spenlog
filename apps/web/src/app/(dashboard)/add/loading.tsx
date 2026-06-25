export default function AddLoading() {
  const Sk = ({ w, h, r = "10px" }: { w: string; h: string; r?: string }) => (
    <div style={{ width: w, height: h, borderRadius: r, background: "#f0f0f0", animation: "pulse 1.5s ease-in-out infinite" }} />
  )
  return (
    <div style={{ paddingBottom: 80 }}>
      <style>{"@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }"}</style>
      <div style={{ display: "flex", gap: 4, background: "#f3f4f6", borderRadius: 14, padding: 4, marginBottom: 20 }}>
        <Sk w="50%" h="36px" r="10px" />
        <Sk w="50%" h="36px" r="10px" />
      </div>
      <div style={{ background: "#fff", borderRadius: 16, padding: 16, marginBottom: 12 }}>
        <Sk w="60px" h="12px" r="6px" />
        <div style={{ marginTop: 12 }}><Sk w="100%" h="48px" r="12px" /></div>
      </div>
      <div style={{ background: "#fff", borderRadius: 16, padding: 16, marginBottom: 12 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ paddingBottom: i < 3 ? 14 : 0, marginBottom: i < 3 ? 14 : 0, borderBottom: i < 3 ? "1px solid #f3f4f6" : "none" }}>
            <Sk w="60px" h="12px" r="6px" />
            <div style={{ marginTop: 8 }}><Sk w="100%" h="36px" r="10px" /></div>
          </div>
        ))}
      </div>
      <Sk w="100%" h="48px" r="14px" />
    </div>
  )
}
