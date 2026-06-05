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
  const [coverPreview, setCoverPreview] = useState<string | null>(currentCoverUrl)
  const [catPreviews, setCatPreviews] = useState<Record<string, string | null>>(currentCategoryUrls)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [catFiles, setCatFiles] = useState<Record<string, File | null>>({})
  const [saving, setSaving] = useState(false)
  const [showPremiumGate, setShowPremiumGate] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [activeHint, setActiveHint] = useState<string | null>(null)
  const coverRef = useRef<HTMLInputElement>(null)
  const catRefs = useRef<Record<string, HTMLInputElement | null>>({})

  function handleClose() {
    setOpen(false)
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
  }

  function handleCatPick(cat: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) { alert('파일 크기는 3MB 이하여야 해요'); return }
    setCatFiles(p => ({ ...p, [cat]: file }))
    setCatPreviews(p => ({ ...p, [cat]: URL.createObjectURL(file) }))
    setDirty(true)
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

  function tapSection(section: string) {
    if (!isPremium) { setShowPremiumGate(true); return }
    if (section === 'cover') { coverRef.current?.click() }
    else { catRefs.current[section]?.click() }
  }

  return (
    <>
      {/* 편집 버튼 (🎨) */}
      <button onClick={() => setOpen(true)}
        style={{
          position: 'fixed', top: 56, right: 16, zIndex: 30,
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(255,255,255,0.9)', border: '1px solid #e5e7eb',
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontSize: 16,
        }}>🎨</button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column', background: 'var(--color-bg)' }}>

          {/* 상단 바 */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px',
            background: 'rgba(255,255,255,0.97)',
            borderBottom: '1px solid #f0f0f0',
            flexShrink: 0,
          }}>
            <button onClick={handleClose} style={{ background: 'none', border: 'none', fontSize: 14, color: '#6b7280', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>취소</button>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#1f2937' }}>홈편집</p>
            <button onClick={handleSave} disabled={saving || !dirty} style={{
              background: 'none', border: 'none', fontSize: 14, fontWeight: 700,
              color: (saving || !dirty) ? '#d1d5db' : 'var(--color-primary)',
              cursor: (saving || !dirty) ? 'default' : 'pointer', fontFamily: 'inherit',
            }}>
              {saving ? '저장 중...' : '적용'}
            </button>
          </div>

          {/* 안내 텍스트 */}
          <div style={{ padding: '10px 16px 6px', background: 'rgba(255,255,255,0.95)', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
            <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>
              {isPremium ? '각 영역을 탭해서 이미지를 변경해보세요' : '✨ 미리보기 가능 · 적용은 프리미엄 필요'}
            </p>
          </div>

          {/* 홈 화면 프리뷰 (스크롤 가능) */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 32px' }}>

            {/* ━━━ 커버 배너 ━━━ */}
            <div
              onClick={() => tapSection('cover')}
              style={{
                position: 'relative', height: 180, cursor: 'pointer',
                background: coverPreview
                  ? undefined
                  : 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-mid) 100%)',
              }}>
              {coverPreview && (
                <img src={coverPreview} alt="cover"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              )}
              {/* 편집 오버레이 */}
              <div style={{
                position: 'absolute', inset: 0,
                background: 'rgba(0,0,0,0.28)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 6,
              }}>
                <div style={{
                  background: 'rgba(255,255,255,0.9)', borderRadius: 12,
                  padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span style={{ fontSize: 16 }}>📷</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1f2937' }}>
                    {coverPreview ? '커버 이미지 변경' : '커버 이미지 추가'}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>탭해서 변경</span>
              </div>
              <input ref={coverRef} type="file" accept="image/png,image/jpeg,image/gif"
                style={{ display: 'none' }} onChange={handleCoverPick} />
            </div>

            {/* ━━━ 카테고리 그리드 ━━━ */}
            <div style={{ padding: '16px 16px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#1f2937' }}>카테고리 현황</p>
                <p style={{ fontSize: 11, color: '#9ca3af' }}>각 카드를 탭해서 이미지 변경</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {CAT_KEYS.map(cat => (
                  <div
                    key={cat}
                    onClick={() => tapSection(cat)}
                    style={{ cursor: 'pointer', position: 'relative' }}>
                    <div style={{
                      height: 90, borderRadius: 14, overflow: 'hidden',
                      background: catPreviews[cat]
                        ? undefined
                        : 'rgba(107,30,46,0.06)',
                      border: '1px solid #f3f4f6',
                    }}>
                      {catPreviews[cat] ? (
                        <img src={catPreviews[cat]!} alt={cat}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      ) : (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: 30 }}>{CAT_EMOJI[cat]}</span>
                        </div>
                      )}
                      {/* 편집 오버레이 */}
                      <div style={{
                        position: 'absolute', inset: 0,
                        background: 'rgba(0,0,0,0.22)',
                        borderRadius: 14,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <div style={{
                          background: 'rgba(255,255,255,0.88)', borderRadius: 8,
                          padding: '4px 10px', fontSize: 11, fontWeight: 700, color: '#1f2937',
                        }}>
                          📷 이미지 변경
                        </div>
                      </div>
                    </div>
                    <p style={{ fontSize: 12, color: '#374151', textAlign: 'center', marginTop: 6, fontWeight: 600 }}>{cat}</p>
                    <input ref={el => { catRefs.current[cat] = el }} type="file" accept="image/png,image/jpeg,image/gif"
                      style={{ display: 'none' }} onChange={e => handleCatPick(cat, e)} />
                  </div>
                ))}
              </div>
            </div>

            {/* ━━━ 안내 카드 ━━━ */}
            {!isPremium && (
              <div style={{ margin: '16px 16px 0', padding: '14px 16px', background: '#fef9e7', borderRadius: 14, border: '1px solid #fde68a' }}>
                <p style={{ fontSize: 13, color: '#92400e', fontWeight: 700, marginBottom: 4 }}>✨ 프리미엄 기능</p>
                <p style={{ fontSize: 12, color: '#b45309', lineHeight: 1.5 }}>
                  미리보기는 자유롭게 체험할 수 있어요.<br />실제 적용하려면 프리미엄이 필요해요.
                </p>
                <button onClick={() => setShowPremiumGate(true)} style={{
                  marginTop: 10, padding: '8px 16px', borderRadius: 10,
                  background: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: '#fff',
                  fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                }}>프리미엄 시작하기</button>
              </div>
            )}
          </div>

          {/* 프리미엄 유도 Bottom Sheet */}
          {showPremiumGate && (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
              display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', zIndex: 10,
            }}>
              <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: '28px 24px 48px', textAlign: 'center' }}>
                <p style={{ fontSize: 22, marginBottom: 8 }}>💎</p>
                <p style={{ fontSize: 16, fontWeight: 800, color: '#1f2937', marginBottom: 8 }}>나만의 대시보드를 완성하려면</p>
                <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 24 }}>프리미엄이 필요해요 ✨</p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setShowPremiumGate(false)} style={{
                    flex: 1, padding: '14px', borderRadius: 14, border: '1.5px solid #e5e7eb',
                    background: '#fff', fontSize: 14, color: '#6b7280', cursor: 'pointer', fontFamily: 'inherit',
                  }}>나중에</button>
                  <button onClick={() => { setShowPremiumGate(false); router.push('/premium') }} style={{
                    flex: 1, padding: '14px', borderRadius: 14, border: 'none',
                    background: 'var(--color-primary)', color: '#fff',
                    fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  }}>프리미엄 시작하기</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}
