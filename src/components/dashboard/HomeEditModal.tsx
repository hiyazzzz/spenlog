'use client'
import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const CAT_KEYS = ['생활비', '활동비', '고정비', '친목비'] as const
const CAT_FIELD: Record<string, string> = {
  '생활비': 'category_img_url_1',
  '활동비': 'category_img_url_2',
  '고정비': 'category_img_url_3',
  '친목비': 'category_img_url_4',
}
const CAT_EMOJI: Record<string, string> = {
  '생활비': '🛒', '활동비': '☕', '고정비': '📌', '친목비': '👫',
}

interface Props {
  userId: string
  isPremium: boolean
  currentCoverUrl: string | null
  currentCategoryUrls: Record<string, string | null>
}

export default function HomeEditModal({ userId, isPremium, currentCoverUrl, currentCategoryUrls }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [activeSection, setActiveSection] = useState<'cover' | string | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(currentCoverUrl)
  const [catPreviews, setCatPreviews] = useState<Record<string, string | null>>(currentCategoryUrls)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [catFiles, setCatFiles] = useState<Record<string, File | null>>({})
  const [saving, setSaving] = useState(false)
  const [showPremiumGate, setShowPremiumGate] = useState(false)
  const [dirty, setDirty] = useState(false)
  const coverRef = useRef<HTMLInputElement>(null)
  const catRefs = useRef<Record<string, HTMLInputElement | null>>({})

  function handleClose() {
    setOpen(false)
    setActiveSection(null)
    setCoverPreview(currentCoverUrl)
    setCatPreviews(currentCategoryUrls)
    setCoverFile(null)
    setCatFiles({})
    setDirty(false)
  }

  function handleCoverPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) { alert('파일 크기는 3MB 이하여야 해요'); return }
    setCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
    setDirty(true)
    setActiveSection(null)
  }

  function handleCatPick(cat: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) { alert('파일 크기는 3MB 이하여야 해요'); return }
    setCatFiles(p => ({ ...p, [cat]: file }))
    setCatPreviews(p => ({ ...p, [cat]: URL.createObjectURL(file) }))
    setDirty(true)
    setActiveSection(null)
  }

  async function uploadFile(file: File, path: string): Promise<string | null> {
    const { data, error } = await supabase.storage
      .from('user-assets')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (error) { console.error('upload error', error); return null }
    const { data: urlData } = supabase.storage.from('user-assets').getPublicUrl(data.path)
    return urlData.publicUrl
  }

  async function handleSave() {
    if (!isPremium) { setShowPremiumGate(true); return }
    setSaving(true)
    const updates: Record<string, string | null> = {}
    if (coverFile) {
      const url = await uploadFile(coverFile, `${userId}/cover-${Date.now()}`)
      if (url) updates['home_cover_url'] = url
    }
    for (const cat of CAT_KEYS) {
      if (catFiles[cat]) {
        const url = await uploadFile(catFiles[cat]!, `${userId}/cat-${cat}-${Date.now()}`)
        if (url) updates[CAT_FIELD[cat]] = url
      }
    }
    if (Object.keys(updates).length > 0) {
      await supabase.from('users').update(updates).eq('id', userId)
    }
    setSaving(false)
    setOpen(false)
    setDirty(false)
    router.refresh()
  }

  return (
    <>
      {/* 편집 버튼 (🎨 팔레트) */}
      <button onClick={() => setOpen(true)}
        style={{
          position: 'fixed', top: 56, right: 16, zIndex: 30,
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(255,255,255,0.9)', border: '1px solid #e5e7eb',
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontSize: 16,
        }}>
        🎨
      </button>

      {/* 인플레이스 편집 오버레이 */}
      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column' }}>

          {/* 상단 바 */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', background: 'rgba(255,255,255,0.97)',
            borderBottom: '1px solid #f0f0f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}>
            <button onClick={handleClose} style={{
              background: 'none', border: 'none', fontSize: 14, color: '#6b7280',
              cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
            }}>취소</button>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#1f2937' }}>홈편집</p>
            <button onClick={handleSave} disabled={saving || !dirty} style={{
              background: 'none', border: 'none', fontSize: 14, fontWeight: 700,
              color: (saving || !dirty) ? '#d1d5db' : 'var(--color-primary)',
              cursor: (saving || !dirty) ? 'default' : 'pointer', fontFamily: 'inherit',
            }}>
              {saving ? '저장 중...' : '적용'}
            </button>
          </div>

          {/* 편집 캔버스 */}
          <div style={{ flex: 1, overflowY: 'auto', background: 'var(--color-bg)' }}>

            {/* 커버 이미지 영역 */}
            <div style={{ position: 'relative' }}>
              <div style={{
                height: 180,
                background: coverPreview ? `url(${coverPreview}) center/cover no-repeat` : 'var(--color-primary)',
              }} />
              {/* 커버 편집 버튼 */}
              <button
                onClick={() => {
                  if (!isPremium) { setShowPremiumGate(true); return }
                  coverRef.current?.click()
                }}
                style={{
                  position: 'absolute', top: 12, left: 12,
                  background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none',
                  borderRadius: 10, padding: '6px 12px', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4,
                }}>
                📷 이미지 변경
              </button>
              <input ref={coverRef} type="file" accept="image/png,image/jpeg,image/gif" style={{ display: 'none' }} onChange={handleCoverPick} />
            </div>

            {/* 카테고리 그리드 편집 */}
            <div style={{ padding: '16px' }}>
              <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 10, fontWeight: 600 }}>카테고리 카드</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {CAT_KEYS.map(cat => (
                  <div key={cat} style={{ position: 'relative' }}>
                    <div style={{
                      height: 90, borderRadius: 14, overflow: 'hidden',
                      background: catPreviews[cat] ? `url(${catPreviews[cat]}) center/cover no-repeat` : 'var(--color-primary-light)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '1.5px solid #f0f0f0',
                    }}>
                      {!catPreviews[cat] && <span style={{ fontSize: 28 }}>{CAT_EMOJI[cat]}</span>}
                    </div>
                    {/* 카테고리 편집 버튼 */}
                    <button
                      onClick={() => {
                        if (!isPremium) { setShowPremiumGate(true); return }
                        catRefs.current[cat]?.click()
                      }}
                      style={{
                        position: 'absolute', top: 6, right: 6,
                        background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none',
                        borderRadius: 8, padding: '4px 8px', fontSize: 11, fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}>
                      ✏️
                    </button>
                    <input ref={el => { catRefs.current[cat] = el }} type="file" accept="image/png,image/jpeg,image/gif"
                      style={{ display: 'none' }} onChange={e => handleCatPick(cat, e)} />
                    <p style={{ fontSize: 11, color: '#6b7280', textAlign: 'center', marginTop: 4, fontWeight: 600 }}>{cat}</p>
                  </div>
                ))}
              </div>

              {/* 무료 유저 안내 */}
              {!isPremium && (
                <div style={{ marginTop: 16, padding: '12px 16px', background: '#fef9e7', borderRadius: 12, border: '1px solid #fde68a' }}>
                  <p style={{ fontSize: 13, color: '#92400e', fontWeight: 600 }}>✨ 이미지 변경은 프리미엄 기능이에요</p>
                  <p style={{ fontSize: 12, color: '#b45309', marginTop: 4 }}>미리보기는 자유롭게! 적용하려면 프리미엄이 필요해요.</p>
                </div>
              )}
            </div>
          </div>

          {/* 프리미엄 유도 바텀시트 */}
          {showPremiumGate && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', zIndex: 10 }}>
              <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: '24px 24px 40px', textAlign: 'center' }}>
                <p style={{ fontSize: 16, fontWeight: 800, color: '#1f2937', marginBottom: 8 }}>나만의 대시보드를 완성하려면</p>
                <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>프리미엄이 필요해요 ✨</p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setShowPremiumGate(false)}
                    style={{ flex: 1, padding: '14px', borderRadius: 14, border: '1.5px solid #e5e7eb', background: '#fff', fontSize: 14, color: '#6b7280', cursor: 'pointer', fontFamily: 'inherit' }}>
                    나중에
                  </button>
                  <button onClick={() => { setShowPremiumGate(false); router.push('/premium') }}
                    style={{ flex: 1, padding: '14px', borderRadius: 14, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    프리미엄 시작하기
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}
