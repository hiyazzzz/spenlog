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
  const [showPremiumSheet, setShowPremiumSheet] = useState(false)
  const [dirty, setDirty] = useState(false)
  const coverRef = useRef<HTMLInputElement>(null)
  const catRefs = useRef<Record<string, HTMLInputElement | null>>({})

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
        cursor: 'pointer', fontSize: 16,
      }}>🎨</button>

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
                {CAT_KEYS.map(cat => (
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
                      {!catPreviews[cat] && <span style={{ fontSize: 28 }}>{CAT_EMOJI[cat]}</span>}
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

            {/* 프리미엄 안내 배너 */}
            {!isPremium && (
              <div style={{ margin: '8px 16px 24px' }}>
                <div style={{
                  borderRadius: 16, overflow: 'hidden',
                  background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
                  padding: '20px 20px 16px',
                  position: 'relative',
                }}>
                  {/* 배경 장식 */}
                  <div style={{
                    position: 'absolute', top: -20, right: -20,
                    width: 100, height: 100, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.05)',
                  }} />
                  <div style={{
                    position: 'absolute', bottom: -30, right: 20,
                    width: 80, height: 80, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.04)',
                  }} />

                  <div style={{ position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 20 }}>💎</span>
                      <p style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>프리미엄으로 업그레이드</p>
                    </div>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, marginBottom: 14 }}>
                      홈화면 커버 이미지와 카테고리 카드를<br />나만의 감성으로 꾸밀 수 있어요
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{
                        flex: 1, padding: '8px 12px', borderRadius: 10,
                        background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
                        textAlign: 'center',
                      }}>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 2 }}>홈 커버</p>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>자유 설정 ✓</p>
                      </div>
                      <div style={{
                        flex: 1, padding: '8px 12px', borderRadius: 10,
                        background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
                        textAlign: 'center',
                      }}>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 2 }}>카테고리 이미지</p>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>자유 설정 ✓</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
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
                  이미지 변경을 미리 체험해봤죠? 😊<br />
                  프리미엄으로 업그레이드하면 실제로 적용돼요
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
