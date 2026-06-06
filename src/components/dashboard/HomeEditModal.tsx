'use client'
import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const DEFAULT_CAT_KEYS = ['생활비', '활동비', '고정비', '친목비']
const CAT_FIELD_IDX = ['category_img_url_1', 'category_img_url_2', 'category_img_url_3', 'category_img_url_4']
const CAT_EMOJI: Record<string, string> = {
  '생활비': '🛒', '활동비': '☕', '고정비': '📌', '친목비': '👫',
  '예비비': '🏦', '수입': '💰',
}
const CAT_EMOJIS_FALLBACK = ['🛒', '☕', '📌', '👫']

interface Props {
  userId: string
  isPremium: boolean
  currentCoverUrl: string | null
  currentCategoryUrls: Record<string, string | null>
  displayName?: string
  totalSpent?: number
  userCategories?: string[]
}

export default function HomeEditModal({ userId, isPremium, currentCoverUrl, currentCategoryUrls, displayName = '소비요정', totalSpent = 0, userCategories }: Props) {
  const supabase = createClient()
  const router = useRouter()
  // 유저 커스텀 카테고리 상위 4개, 없으면 기본
  const catKeysToUse = (userCategories && userCategories.length > 0 ? userCategories : DEFAULT_CAT_KEYS).slice(0, 4)
  const CAT_FIELD: Record<string, string> = Object.fromEntries(catKeysToUse.map((cat, i) => [cat, CAT_FIELD_IDX[i]]))
  const [open, setOpen] = useState(false)
  const [coverPreview, setCoverPreview] = useState<string | null>(currentCoverUrl)
  const [catPreviews, setCatPreviews] = useState<Record<string, string | null>>(currentCategoryUrls)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [catFiles, setCatFiles] = useState<Record<string, File | null>>({})
  const [saving, setSaving] = useState(false)
  const [showPremiumSheet, setShowPremiumSheet] = useState(false)
  const [dirty, setDirty] = useState(false)
  const coverRef = useRef<HTMLInputElement>(null)
  const catRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // 저장 후 router.refresh() 시 props 변경 → 즉각 state 동기화
  useEffect(() => {
    if (!open) {
      setCoverPreview(currentCoverUrl)
      setCatPreviews(currentCategoryUrls)
    }
  }, [currentCoverUrl, currentCategoryUrls, open])

  function handleClose() {
    setOpen(false)
    // 미리보기 초기화 (저장 안 했으면 되돌림)
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

  async function doSave() {
    setSaving(true)
    const updates: Record<string, string | null> = {}
    if (coverFile) {
      const url = await uploadFile(coverFile, `${userId}/cover-${Date.now()}`)
      if (url) updates['home_cover_url'] = url
    }
    for (const cat of catKeysToUse) {
      if (catFiles[cat]) {
        const url = await uploadFile(catFiles[cat]!, `${userId}/cat-${cat}-${Date.now()}`)
        if (url) updates[CAT_FIELD[cat]] = url
      }
    }
    if (Object.keys(updates).length > 0) {
      await supabase.from('users').update(updates).eq('id', userId)
    }
    setSaving(false)
    // 업로드된 URL로 즉각 state 업데이트 (router.refresh 전 즉각 반영)
    if (updates['home_cover_url']) setCoverPreview(updates['home_cover_url'])
    const newCatPreviews = { ...catPreviews }
    for (const cat of catKeysToUse) {
      const field = CAT_FIELD[cat]
      if (field && updates[field]) newCatPreviews[cat] = updates[field]
    }
    setCatPreviews(newCatPreviews)
    setOpen(false)
    setDirty(false)
    router.refresh()
  }

  // 적용 버튼: 비프리미엄이면 Bottom Sheet
  function handleApply() {
    if (!dirty) return
    if (!isPremium) { setShowPremiumSheet(true); return }
    doSave()
  }

  return (
    <>
      {/* 편집 버튼 */}
      <button onClick={() => setOpen(true)} style={{
        position: 'fixed', top: 56, right: 16, zIndex: 30,
        width: 36, height: 36, borderRadius: '50%',
        background: 'rgba(255,255,255,0.9)', border: '1px solid #e5e7eb',
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: 'var(--color-primary)',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column', background: 'var(--color-bg)' }}>

          {/* ── 상단 바 (네이버 블로그 스타일) ── */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 20px',
            background: '#fff',
            borderBottom: '1px solid #f0f0f0',
            flexShrink: 0,
          }}>
            <button onClick={handleClose} style={{
              background: 'none', border: 'none', fontSize: 14, color: '#6b7280',
              cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
            }}>취소</button>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#1f2937' }}>홈편집</p>
            <button
              onClick={handleApply}
              disabled={saving || !dirty}
              style={{
                background: 'none', border: 'none', fontSize: 14, fontWeight: 700,
                color: (saving || !dirty) ? '#d1d5db' : 'var(--color-primary)',
                cursor: (saving || !dirty) ? 'default' : 'pointer', fontFamily: 'inherit',
              }}
            >
              {saving ? '저장 중...' : '적용'}
            </button>
          </div>

          {/* ── 홈 화면 프리뷰 (스크롤 가능) ── */}
          <div style={{ flex: 1, overflowY: 'auto' }}>

            {/* 커버 배너 영역 */}
            <div style={{ position: 'relative' }}>
              {/* 실제 커버 이미지/배경 */}
              <div style={{
                height: 200,
                background: coverPreview
                  ? `url(${coverPreview}) center/cover no-repeat`
                  : 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-mid) 100%)',
                position: 'relative',
              }}>
                {/* 홈 화면 콘텐츠 (닉네임, 지출 등) */}
                <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16 }}>
                  <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>이번 달 지출</p>
                  <p style={{ color: '#fff', fontSize: 24, fontWeight: 800 }}>₩0</p>
                </div>
              </div>

              {/* 커버 편집 오버레이 버튼 2개 (네이버 블로그 스타일) */}
              <div style={{
                position: 'absolute', top: 12, left: 12, right: 12,
                display: 'flex', gap: 8,
              }}>
                <button
                  onClick={() => coverRef.current?.click()}
                  style={{
                    flex: 1, padding: '8px 0',
                    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                    border: '1px solid rgba(255,255,255,0.3)', borderRadius: 10,
                    color: '#fff', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  }}>
                  <span>📷</span> 이미지 변경
                </button>
                {coverPreview && (
                  <button
                    onClick={() => { setCoverPreview(null); setCoverFile(null); setDirty(true) }}
                    style={{
                      padding: '8px 14px',
                      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                      border: '1px solid rgba(255,255,255,0.3)', borderRadius: 10,
                      color: '#fff', fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                    제거
                  </button>
                )}
              </div>
              <input ref={coverRef} type="file" accept="image/png,image/jpeg,image/gif"
                style={{ display: 'none' }} onChange={handleCoverPick} />
            </div>

            {/* 카테고리 그리드 */}
            <div style={{ padding: '16px' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 }}>카테고리 현황</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {catKeysToUse.map((cat, catIdx) => (
                  <div key={cat} style={{ position: 'relative' }}>
                    {/* 카테고리 카드 */}
                    <div style={{
                      height: 90, borderRadius: 14, overflow: 'hidden',
                      background: catPreviews[cat]
                        ? `url(${catPreviews[cat]}) center/cover no-repeat`
                        : 'rgba(107,30,46,0.06)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '1px solid #f0f0f0',
                    }}>
                      {!catPreviews[cat] && <span style={{ fontSize: 28 }}>{CAT_EMOJI[cat] ?? CAT_EMOJIS_FALLBACK[catIdx] ?? '📁'}</span>}
                    </div>

                    {/* 편집 버튼 오버레이 */}
                    <button
                      onClick={() => catRefs.current[cat]?.click()}
                      style={{
                        position: 'absolute', top: 6, right: 6,
                        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
                        border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8,
                        color: '#fff', fontSize: 10, fontWeight: 700,
                        padding: '4px 8px', cursor: 'pointer', fontFamily: 'inherit',
                        display: 'flex', alignItems: 'center',
                      }}>
                      📷 변경
                    </button>
                    <input ref={el => { catRefs.current[cat] = el }} type="file"
                      accept="image/png,image/jpeg,image/gif"
                      style={{ display: 'none' }} onChange={e => handleCatPick(cat, e)} />

                    <p style={{ fontSize: 12, color: '#374151', textAlign: 'center', marginTop: 5, fontWeight: 600 }}>{cat}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* 프리미엄 Bottom Sheet */}
          {showPremiumSheet && (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)',
              display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', zIndex: 10,
            }}>
              <div style={{
                background: '#fff', borderRadius: '24px 24px 0 0',
                padding: '28px 24px 48px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                  <div style={{ width: 40, height: 4, borderRadius: 2, background: '#e5e7eb' }} />
                </div>
                <p style={{ fontSize: 22, textAlign: 'center', marginBottom: 10 }}>💎</p>
                <p style={{ fontSize: 18, fontWeight: 800, color: '#1f2937', textAlign: 'center', marginBottom: 8 }}>
                  홈화면 꾸미기는 프리미엄 기능이에요
                </p>
                <p style={{ fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 1.6, marginBottom: 24 }}>
                  홈화면 이미지 편집은 프리미엄 기능이에요.<br />
                  업그레이드하면 나만의 감성으로 꾸밀 수 있어요.
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setShowPremiumSheet(false)} style={{
                    flex: 1, padding: '14px', borderRadius: 14,
                    border: '1.5px solid #e5e7eb', background: '#fff',
                    fontSize: 14, color: '#6b7280', cursor: 'pointer', fontFamily: 'inherit',
                  }}>나중에</button>
                  <button onClick={() => { setShowPremiumSheet(false); router.push('/premium') }} style={{
                    flex: 1, padding: '14px', borderRadius: 14, border: 'none',
                    background: 'linear-gradient(135deg, var(--color-primary), #9B2C45)',
                    color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
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
