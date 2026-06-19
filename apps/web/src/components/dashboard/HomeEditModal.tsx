'use client'
import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/format'
import { THEME_CARD_PALETTES, THEME_COVER_GRADIENTS } from '@/lib/themes'
import dayjs from 'dayjs'

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
  recentExpenses?: { id: string; name?: string; memo?: string; amount: number; category: string; date?: string; payment_method?: string | null }[]
  expenses?: { category: string; amount: number; type?: string }[]
  budgets?: { category: string; amount: number }[]
  currentGreeting?: string | null
}

export default function HomeEditModal({
  userId, isPremium, currentCoverUrl, currentCategoryUrls,
  displayName = '소비요정', totalSpent = 0, savingGoal = 0, actualSaving = 0,
  userCategories, theme, recentExpenses = [], expenses = [], budgets = [],
  currentGreeting = null,
}: Props) {
  const supabase = createClient()
  const router = useRouter()
  const catKeysToUse = (userCategories && userCategories.length > 0 ? userCategories : DEFAULT_CAT_KEYS).slice(0, 4)
  const CAT_FIELD: Record<string, string> = Object.fromEntries(catKeysToUse.map((cat, i) => [cat, CAT_FIELD_IDX[i]]))
  const palette = THEME_CARD_PALETTES[(theme as string) ?? 'Burgundy'] ?? DEFAULT_PALETTE
  const coverGradient = THEME_COVER_GRADIENTS[(theme as string) ?? 'Burgundy'] ?? THEME_COVER_GRADIENTS.Burgundy

  // HomeCategoryGrid와 동일한 계산
  const catMap: Record<string, number> = {}
  expenses.filter(e => e.type !== 'transfer').forEach(e => {
    const sign = e.type === 'income' ? 1 : -1
    catMap[e.category] = (catMap[e.category] ?? 0) + sign * Number(e.amount)
  })

  const [open, setOpen] = useState(false)
  const [coverPreview, setCoverPreview] = useState<string | null>(currentCoverUrl)
  const [catPreviews, setCatPreviews] = useState<Record<string, string | null>>(currentCategoryUrls)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [catFiles, setCatFiles] = useState<Record<string, File | null>>({})
  const [saving, setSaving] = useState(false)
  const [showPremiumSheet, setShowPremiumSheet] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [greetingText, setGreetingText] = useState(currentGreeting ?? '')
  const [greetingSaving, setGreetingSaving] = useState(false)
  const coverRef = useRef<HTMLInputElement>(null)
  const catRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    if (!open) {
      setCoverPreview(currentCoverUrl)
      setCatPreviews(currentCategoryUrls)
      setGreetingText(currentGreeting ?? '')
    }
  }, [currentCoverUrl, currentCategoryUrls, currentGreeting, open])

  useEffect(() => {
    if (open) {
      // 스크롤바 폭 보정 + scroll position 고정 (모바일/DevTools 모두 대응)
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
      const scrollY = window.scrollY
      document.body.style.paddingRight = `${scrollbarWidth}px`
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.width = '100%'
    } else {
      const savedScrollY = Math.abs(parseInt(document.body.style.top || '0', 10))
      document.body.style.paddingRight = ''
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      window.scrollTo(0, savedScrollY)
    }
    return () => {
      const savedScrollY = Math.abs(parseInt(document.body.style.top || '0', 10))
      document.body.style.paddingRight = ''
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      if (savedScrollY) window.scrollTo(0, savedScrollY)
    }
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

    // 커버 이미지: 새 파일 업로드 OR 삭제(null)
    if (coverFile) {
      const url = await uploadFile(coverFile, `${userId}/cover-${Date.now()}`)
      if (url) updates['home_cover_url'] = url
    } else if (coverPreview === null && currentCoverUrl) {
      // 사용자가 커버 이미지를 삭제한 경우 DB도 null로
      updates['home_cover_url'] = null
    }

    // 카테고리 이미지: 파일 경로에 한글 금지 → 슬롯 인덱스(숫자)로 대체
    for (let i = 0; i < catKeysToUse.length; i++) {
      const cat = catKeysToUse[i]
      if (catFiles[cat]) {
        const url = await uploadFile(catFiles[cat]!, `${userId}/cat-slot-${i + 1}-${Date.now()}`)
        if (url) updates[CAT_FIELD_IDX[i]] = url
      } else if (catPreviews[cat] === null && currentCategoryUrls[cat] !== null) {
        // 사용자가 카테고리 이미지를 삭제한 경우 DB도 null로
        updates[CAT_FIELD_IDX[i]] = null
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

  // TODO: greeting_custom_text 컬럼 마이그레이션 적용 전까지는 저장 API가 500을 반환함.
  // TODO: 인사말 커스텀 편집을 프리미엄 기능으로 묶을지 여부 기획 확인 필요 (현재는 무료로 동작)
  async function saveGreeting() {
    setGreetingSaving(true)
    try {
      const res = await fetch('/api/greeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: greetingText }),
      })
      if (!res.ok) {
        alert('인사말 저장에 실패했어요')
        return
      }
      router.refresh()
    } finally {
      setGreetingSaving(false)
    }
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
      {/* 편집 버튼 — 커버 우상단 pill (page.tsx 커버 div 안에서 렌더됨) */}
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'absolute', top: 14, right: 14,
          zIndex: 10,
          background: 'rgba(255,255,255,0.18)',
          border: '0.5px solid rgba(255,255,255,0.40)',
          borderRadius: 20,
          padding: '5px 14px',
          display: 'flex', alignItems: 'center', gap: 5,
          cursor: 'pointer',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          whiteSpace: 'nowrap',
          fontFamily: 'inherit',
        }}
        aria-label="홈 꾸미기"
      >
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.90)', letterSpacing: '0.01em' }}>✦ 홈 꾸미기</span>
      </button>

      {open && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'var(--color-bg, #faf7f4)',
          overflowY: 'auto',
        } as React.CSSProperties}>

          {/* 상단 편집 바 */}
          <div style={{
            background: 'rgba(255,255,255,0.95)',
            borderBottom: '1px solid #f0f0f0',
            position: 'sticky', top: 0, zIndex: 10,
            backdropFilter: 'blur(8px)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '17px 20px', maxWidth: 448, margin: '0 auto' }}>
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
          </div>

          {/* 홈 화면과 동일한 레이아웃 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 16px 80px', maxWidth: 448, margin: '0 auto', width: '100%' }}>

            {/* 1. 커버 배너 — 편집 가능 */}
            <div style={{
              height: 200, borderRadius: 16, overflow: 'hidden', position: 'relative',
              background: coverPreview ? undefined : coverGradient,
            }}>
              {coverPreview && (
                <img src={coverPreview} alt="cover"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
              )}
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.28)' }} />
              {/* 인사말 — 상단 좌측 */}
              <div style={{ position: 'absolute', top: 18, left: 18 }}>
                <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginBottom: 4 }}>안녕하세요 👋</p>
                <p style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>{displayName}님</p>
              </div>
              {/* 스탯 — 하단 풀워스 바 */}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.38)', padding: '10px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 10, margin: 0 }}>이번 달 지출</p>
                  <p style={{ color: '#fff', fontSize: 15, fontWeight: 800, margin: 0 }}>{formatCurrency(totalSpent)}</p>
                </div>
                {savingGoal > 0 && (
                  <>
                    <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.2)' }} />
                    <div style={{ textAlign: 'right' as const }}>
                      <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 10, margin: 0 }}>저축 달성</p>
                      <p style={{ color: '#a7f3d0', fontSize: 13, fontWeight: 700, margin: 0 }}>{formatCurrency(actualSaving)} / {formatCurrency(savingGoal)}</p>
                    </div>
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
                }}>이미지 변경</button>
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

            {/* 1.5 인사말 편집 — skeleton (greeting_custom_text 마이그레이션 적용 전까지 저장 비활성) */}
            <div style={card}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#1f2937', marginBottom: 10 }}>인사말 편집</p>
              <input
                type="text"
                value={greetingText}
                onChange={e => setGreetingText(e.target.value)}
                placeholder="나만의 인사말을 입력해보세요 (최대 40자)"
                maxLength={40}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 10,
                  border: '1px solid #f3f4f6', fontSize: 13, fontFamily: 'inherit',
                  color: '#1f2937', boxSizing: 'border-box' as const,
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  onClick={saveGreeting}
                  disabled={greetingSaving || greetingText.trim().length === 0}
                  style={{
                    padding: '6px 14px', borderRadius: 10, border: 'none',
                    background: greetingSaving ? '#d1d5db' : 'var(--color-primary)',
                    color: '#fff', fontSize: 12, fontWeight: 700,
                    cursor: greetingSaving ? 'default' : 'pointer', fontFamily: 'inherit',
                  }}
                >{greetingSaving ? '저장 중...' : '저장'}</button>
              </div>
            </div>

            {/* 2. 한 줄 기록 — 반투명 딤 (홈화면과 동일한 UI) */}
            <div style={{ ...card, position: 'relative', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#1f2937' }}>한 줄 기록</p>
                {/* 홈화면과 동일: 연필 아이콘 + var(--color-border) 배경 */}
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </div>
              </div>
              {/* AiInputBox와 동일한 구조: bg-white rounded-2xl border border-gray-100 p-4 */}
              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #f3f4f6', padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ fontSize: 13, color: '#d1d5db', lineHeight: 1.7, minHeight: 60 }}>
                  오늘 소비 내역을 알려줘!<br/>예) 아아 삼천원<br/>예) 스벅 6천원 배민 치킨 18000원
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                  <div style={{ padding: '6px 12px', borderRadius: 10, background: 'var(--color-primary)', color: '#fff', fontSize: 14, fontWeight: 500 }}>AI 분류</div>
                </div>
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
                  // HomeCategoryGrid와 동일한 계산
                  const net = catMap[cat] ?? 0
                  const spent = Math.abs(net)
                  const budget = budgets.find(b => b.category === cat)?.amount ?? 0
                  const pct = budget > 0 ? Math.min(Math.round((spent / budget) * 100), 100) : 0
                  const over = budget > 0 && spent > budget
                  const barColor = over ? '#ef4444' : pct >= 70 ? '#f59e0b' : 'var(--color-primary)'
                  return (
                    <div key={cat} style={{
                      display: 'flex', flexDirection: 'column',
                      background: '#fff', borderRadius: 16,
                      border: '1px solid #f3f4f6', overflow: 'hidden',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                    }}>
                      {/* 이미지 영역 (HomeCategoryGrid와 동일) */}
                      <div style={{
                        height: 80,
                        background: imgUrl ? `url(${imgUrl}) center/cover no-repeat` : cardBgColor,
                        position: 'relative',
                      }}>
                        {over && (
                          <span style={{ position: 'absolute', top: 6, right: 6, fontSize: 10, background: '#fef2f2', color: '#ef4444', padding: '2px 6px', borderRadius: 6, fontWeight: 700 }}>초과 ⚠️</span>
                        )}
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.35))', padding: '8px 10px 6px' }}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>{cat}</p>
                        </div>
                        {/* 편집 오버레이 */}
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                          {imgUrl ? (
                            <>
                              <button onClick={() => catRefs.current[cat]?.click()} style={{ padding: '5px 10px', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>변경</button>
                              <button onClick={() => { setCatPreviews(p => ({ ...p, [cat]: null })); setCatFiles(p => ({ ...p, [cat]: null })); setDirty(true) }} style={{ padding: '5px 10px', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>제거</button>
                            </>
                          ) : (
                            <button onClick={() => catRefs.current[cat]?.click()} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, color: '#fff', fontWeight: 600 }}>탭하여 변경</button>
                          )}
                        </div>
                      </div>
                      {/* 금액 + 예산 바 (HomeCategoryGrid와 동일) */}
                      <div style={{ padding: '8px 10px' }}>
                        <p style={{ fontSize: 14, fontWeight: 800, color: net > 0 ? '#059669' : net < 0 ? 'var(--color-primary)' : '#d1d5db' }}>
                          {net > 0 ? '+' : net < 0 ? '-' : ''}{net !== 0 ? formatCurrency(spent) : formatCurrency(0)}
                        </p>
                        {budget > 0 && (
                          <div style={{ marginTop: 4 }}>
                            <div style={{ background: '#f3f4f6', borderRadius: 4, height: 3, overflow: 'hidden' }}>
                              <div style={{ width: pct + '%', height: '100%', background: barColor, borderRadius: 4 }} />
                            </div>
                            <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>예산 {pct}% 사용</p>
                          </div>
                        )}
                      </div>
                      <input ref={el => { catRefs.current[cat] = el }} type="file" accept="image/png,image/jpeg,image/gif" style={{ display: 'none' }} onChange={e => handleCatPick(cat, e)} />
                    </div>
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
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {recentExpenses.map(e => (
                    <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f9fafb' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, color: '#1f2937', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name ?? e.memo}</p>
                        <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                          {e.date ? dayjs(e.date).format('MM.DD') + ' · ' : ''}{e.category}{e.payment_method ? ' · ' + e.payment_method : ''}
                        </p>
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#fb7185', marginLeft: 12, flexShrink: 0 }}>-{formatCurrency(e.amount)}</p>
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

          {/* 하단 탭바 프리뷰 */}
          <nav style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            background: '#fff', borderTop: '1px solid #f3f4f6',
            display: 'flex', minHeight: 56, zIndex: 101,
          }}>
            {[{label:'홈', active: true}, {label:'내역'}, {label:'자산'}, {label:'리포트'}, {label:'설정'}].map(({ label, active }) => (
              <div key={label} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: active ? 13 : 12, fontWeight: active ? 700 : 500,
                color: active ? 'var(--color-primary)' : '#AAAAAA',
                position: 'relative',
              }}>
                {active && <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', height: 2, width: 32, borderRadius: 1, background: 'var(--color-primary)' }} />}
                {label}
              </div>
            ))}
          </nav>

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
