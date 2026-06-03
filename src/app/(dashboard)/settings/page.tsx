'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { THEMES } from '@/lib/themes'
import { Theme } from '@/types'

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  // 임시 테마 변경 처리 (Zustand 스토어 확장 시 반영 가능)
  function handleThemeChange(themeName: Theme) {
    alert(`${themeName} 테마가 선택되었습니다! (추후 전역 반영 예정)`)
  }

  return (
    <div className="min-h-screen bg-[#FAF7F4] px-4 pt-6 pb-20">
      <h1 className="text-lg font-semibold text-[#4A1220] mb-5">설정</h1>

      {/* 테마 변경 섹션 */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 mb-4">
        <p className="text-xs text-gray-400 mb-3">어플리케이션 테마</p>
        <div className="grid grid-cols-2 gap-2">
          {Object.keys(THEMES).map((key) => {
            const t = THEMES[key as Theme]
            return (
              <button
                key={key}
                onClick={() => handleThemeChange(key as Theme)}
                className="flex items-center gap-2 p-3 rounded-xl border border-gray-50 bg-[#FAF7F4] text-left transition-all hover:border-gray-300"
              >
                <div 
                  className="w-4 h-4 rounded-full border border-black/5" 
                  style={{ backgroundColor: t.primary }} 
                />
                <span className="text-xs font-medium text-gray-700">{key}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 계정 관리 섹션 */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100">
        <p className="text-xs text-gray-400 mb-2">계정</p>
        <button
          onClick={handleLogout}
          className="w-full text-left text-sm font-medium text-rose-500 py-2"
        >
          로그아웃
        </button>
      </div>
    </div>
  )
}