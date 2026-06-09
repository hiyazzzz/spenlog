'use client'
import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/format'
import { THEME_CARD_PALETTES } from '@/lib/themes'

const DEFAULT_CAT_KEYS = ['생활비', '활동비', '고정비', '친목비']
const CAT_FIELD_IDX = ['category_img_url_1', 'category_img_url_2', 'category_img_url_3', 'category_img_url_4']
const DEFAULT_PALETTE = THEME_CARD_PALETTES['Burgundy']

interface Props {
  userId: string
  isPremium: boolean
  currentCoverUrl: string | null
  currentCategoryUrls: Record<string, string | null>
  displayName?: string
  totalSpent?: number
  savingGoal?: number
  actualSaving?: number
  userCategories?: string[]
  theme?: string | null
  recentExpenses?: { id: string; memo: string; amount: number; category: string }[]
}

export default function HomeEditModal({
  userId, isPremium, currentCoverUrl, currentCategoryUrls,
  displayName = '소비요정', totalSpent = 0, savingGoal = 0, actualSaving = 0,
  userCategories, theme, recentExpenses = [],
}: Props) {
  const supabase = createClient()
  const router = useRouter()
  const catKeysToUse = (userCategories && userCategories.length > 0 ? userCategories : DEFAULT_CAT_KEYS).slice(0, 4)
  const CAT_FIELD: Record<string, string> = Object.fromEntries(catKeysToUse.map((cat, i) => [cat, CAT_FIELD_IDX[i]]))
  const palette = THEME_CARD_PALETTES[(theme as string) ?? 'Burgundy'] ?? DEFAULT_PALETTE

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

  useEffect(() => {
    if (!open) {
      setCoverPreview(currentCoverUrl)
      setCatPreviews(currentCategoryUrls)
    }
  }, [currentCoverUrl, currentCategoryUrls, open])

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  function handleClose() {
    if (dirty && !window.confirm('변경 사항이 저장되지 않습니다. 나가시겠어요?')) return
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
    setOpen(false)
    setDirty(false)
    router.refresh()
  }

  function handleApply() {
    if (!dirty) { setOpen(false); return }
    if (!isPremium) { setShowPremiumSheet(true); return }
    doSave()
  }

  // page.tsx와 동일한 카드 스타일
  const card = {
    background: '#fff',
    borderRadius: 16,
    border: '1px solid #f3f4f6',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    padding: 20,
    minHeight: 160,
  } as const

  // 반투명 딤 오버레이 (텍스트 없음)
  const dimOverlay: React.CSSProperties = {
    position: 'absolute', inset: 0,
    background: 'rgba(250,247,244,0.60)',
    borderRadius: 16,
  }

  return (
    <>
      {/* 편집 버튼 (연필 아이콘) */}
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed', top: 56, right: 16, zIndex: 30,
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(255,255,255,0.9)', border: '1px solid #e5e7eb',
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'var(--color-primary)',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'var(--color-bg, #faf7f4)',
          overflowY: 'auto',
        } as React.CSSProperties}>

          {/* 상단 편집 바 */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 20px',
            background: 'rgba(255,255,255,0.95)',
            borderBottom: '1px solid #f0f0f0',
            position: 'sticky', top: 0, zIndex: 10,
            backdropFilter: 'blur(8px)',
          }}>
            <button onClick={handleClose} style={{
              background: 'none', border: 'none', fontSize: 14, color: '#6b7280',
              cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, minWidth: 48,
            }}>취소</button>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#1f2937' }}>홈편집</p>
            <button onClick={handleApply} disabled={saving} style={{
              background: 'none', border: 'none', fontSize: 14, fontWeight: 700,
              color: saving ? '#d1d5db' : 'var(--color-primary)',
              cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit', minWidth: 48, textAlign: 'right' as const,
            }}>{saving ? '저장 중...' : '적용'}</button>
          </div>

          {/* 홈 화면과 동일한 레이아웃 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 16px 48px' }}>

            {/* 1. 커버 배너 — 편집 가능 */}
            <div style={{
              height: 200, borderRadius: 16, overflow: 'hidden', position: 'relative',
              background: coverPreview ? undefined : 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-mid) 100%)',
            }}>
              {coverPreview && (
                <img src={coverPreview} alt="cover"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
              )}
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.28)' }} />
              <div style={{ position: 'absolute', bottom: 20, left: 20 }}>
                <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginBottom: 4 }}>안녕하세요 👋</p>
                <p style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>{displayName}님</p>
              </div>
              <div style={{ position: 'absolute', bottom: 20, right: 20, textAlign: 'right' as const }}>
                <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11 }}>이번 달 지출</p>
                <p style={{ color: '#fff', fontSize: 16, fontWeight: 800 }}>{formatCurrency(totalSpent)}</p>
                {savingGoal > 0 && (
                  <>
                    <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 4 }}>저축 달성</p>
                    <p style={{ color: '#a7f3d0', fontSize: 14, fontWeight: 700 }}>{formatCurrency(actualSaving)} / {formatCurrency(savingGoal)}</p>
                  </>
                )}
              </div>
              <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 8 }}>
                <button onClick={() => coverRef.current?.click()} style={{
                  padding: '7px 14px',
                  background: 'rgba(0,0,0,0.52)', backdropFilter: 'blur(4px)',
                  border: '1px solid rgba(255,255,255,0.3)', borderRadius: 10,
                  color: '#fff', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>📷 이미지 변경</button>
                {coverPreview && (
                  <button onClick={() => { setCoverPreview(null); setCoverFile(null); setDirty(true) }} style={{
                    padding: '7px 12px',
                    background: 'rgba(0,0,0,0.52)', backdropFilter: 'blur(4px)',
                    border: '1px solid rgba(255,255,255,0.3)', borderRadius: 10,
                    color: '#fff', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>제거</button>
                )}
              </div>
              <input ref={coverRef} type="file" accept="image/png,image/jpeg,image/gif"
                style={{ display: 'none' }} onChange={handleCoverPick} />
            </div>

            {/* 2. 한 줄 기록 — 반투명 딤 */}
            <div style={{ ...card, position: 'relative', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#1f2937' }}>한 줄 기록</p>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'var(--color-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 18, fontWeight: 700,
                }}>+</div>
              </div>
              <div style={{
                background: '#f9fafb', borderRadius: 12, padding: '12px 14px',
                fontSize: 13, color: '#9ca3af', lineHeight: 1.7,
              }}>
                <p>오늘 소비 내역을 알려줘!</p>
                <p>예) 아아 삼천원</p>
                <p>예) 스벅 6천원 배민 치킨 18000원</p>
              </div>
              <div style={dimOverlay} />
            </div>

            {/* 3. 카테고리 현황 — HomeCategoryGrid와 동일 구조 + 편집 오버레이 */}
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#1f2937' }}>카테고리 현황</p>
                <span style={{ fontSize: 12, color: 'var(--color-primary-mid)' }}>카테고리 관리 →</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {catKeysToUse.map((cat, catIdx) => {
                  const imgUrl = catPreviews[cat]
                  const cardBgColor = palette[catIdx] ?? palette[0]
                  return (
                    <button
                      key={cat}
                      onClick={() => catRefs.current[cat]?.click()}
                      style={{
                        display: 'flex', flexDirection: 'column',
                        background: '#fff', borderRadius: 16,
                        border: '1px solid #f3f4f6',
                        overflow: 'hidden',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                        cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' as const,
                        padding: 0,
                      }}>
                      {/* 이미지 영역 — HomeCategoryGrid와 동일, 편집 오버레이 추가 */}
                      <div style={{
                        height: 80,
                        background: imgUrl ? `url(${imgUrl}) center/cover no-repeat` : cardBgColor,
                        position: 'relative',
                      }}>
                        {/* 카테고리명 gradient (홈과 동일) */}
                        <div style={{
                          position: 'absolute', bottom: 0, left: 0, right: 0,
                          background: 'linear-gradient(transparent, rgba(0,0,0,0.35))',
                          padding: '8px 10px 6px',
                        }}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>{cat}</p>
                        </div>
                        {/* 편집 오버레이 — 반투명 + 📷 아이콘 */}
                        <div style={{
                          position: 'absolute', inset: 0,
                          background: 'rgba(0,0,0,0.32)',
                          display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center', gap: 3,
                        }}>
                          <span style={{ fontSize: 18 }}>📷</span>
                          <span style={{ fontSize: 10, color: '#fff', fontWeight: 600 }}>탭하여 변경</span>
                        </div>
                      </div>
                      {/* 금액 영역 — HomeCategoryGrid와 동일 */}
                      <div style={{ padding: '8px 10px' }}>
                        <p style={{ fontSize: 14, fontWeight: 800, color: '#d1d5db' }}>
                          {formatCurrency(0)}
                        </p>
                      </div>
                      <input
                        ref={el => { catRefs.current[cat] = el }}
                        type="file" accept="image/png,image/jpeg,image/gif"
                        style={{ display: 'none' }} onChange={e => handleCatPick(cat, e)} />
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 4. 최근 지출 내역 — 반투명 딤 */}
            <div style={{ ...card, position: 'relative', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#1f2937' }}>최근 지출 내역</p>
                <span style={{ fontSize: 12, color: 'var(--color-primary-mid)' }}>전체 보기 →</span>
              </div>
              {recentExpenses.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {recentExpenses.map(e => (
                    <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p style={{ fontSize: 13, color: '#1f2937', fontWeight: 500 }}>{e.memo}</p>
                        <p style={{ fontSize: 11, color: '#9ca3af' }}>{e.category}</p>
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary)' }}>-{formatCurrency(e.amount)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center' as const, paddingTop: 16, paddingBottom: 16 }}>
                  아직 기록된 지출이 없어요
                </p>
              )}
              <div style={dimOverlay} />
            </div>

          </div>

          {/* 프리미엄 Bottom Sheet */}
          {showPremiumSheet && (
            <div style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
              display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', zIndex: 200,
            }}>
              <div style={{ background: '#fff', borderRadius: '24px 24px 0 0', padding: '28px 24px 48px' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                  <div style={{ width: 40, height: 4, borderRadius: 2, background: '#e5e7eb' }} />
                </div>
                <p style={{ fontSize: 22, textAlign: 'center' as const, marginBottom: 10 }}>💎</p>
                <p style={{ fontSize: 18, fontWeight: 800, color: '#1f2937', textAlign: 'center' as const, marginBottom: 8 }}>
                  나만의 대시보드를 완성하려면<br/>프리미엄이 필요해요 ✨
                </p>
                <p style={{ fontSize: 14, color: '#6b7280', textAlign: 'center' as const, lineHeight: 1.6, marginBottom: 24 }}>
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
