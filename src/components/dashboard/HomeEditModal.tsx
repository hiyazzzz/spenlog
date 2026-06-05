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
  const coverRef = useRef<HTMLInputElement>(null)
  const catRefs = useRef<Record<string, HTMLInputElement | null>>({})

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
    const { data: { publicUrl } } = supabase.storage.from('user-assets').getPublicUrl(path)
    return publicUrl
  }

  async function handleSave() {
    if (!isPremium) { setShowPremiumGate(true); return }
    setSaving(true)
    try {
      const updates: Record<string, string | null> = {}

      if (coverFile) {
        const url = await uploadFile(coverFile, userId + '/home_cover.' + coverFile.name.split('.').pop())
        if (url) updates['home_cover_url'] = url
      } else if (coverPreview === null && currentCoverUrl) {
        updates['home_cover_url'] = null
      }

      for (const cat of CAT_KEYS) {
        const file = catFiles[cat]
        const field = CAT_FIELD[cat]
        if (file) {
          const ext = file.name.split('.').pop()
          const url = await uploadFile(file, userId + '/category_' + (CAT_KEYS.indexOf(cat) + 1) + '.' + ext)
          if (url) updates[field] = url
        } else if (catPreviews[cat] === null && currentCategoryUrls[cat]) {
          updates[field] = null
        }
      }

      if (Object.keys(updates).length > 0) {
        await supabase.from('users').update(updates).eq('id', userId)
      }
      setDirty(false)
      setOpen(false)
      router.refresh()
    } catch (e) {
      alert('저장 중 오류가 발생했어요')
    } finally {
      setSaving(false)
    }
  }

  function handleClose() {
    if (dirty) {
      if (!confirm('변경 사항이 저장되지 않습니다. 나가시겠어요?')) return
      setCoverPreview(currentCoverUrl)
      setCatPreviews(currentCategoryUrls)
      setCoverFile(null)
      setCatFiles({})
      setDirty(false)
    }
    setOpen(false)
    setShowPremiumGate(false)
  }

  return (
    <>
      {/* 편집 버튼 */}
      <button onClick={() => setOpen(true)}
        style={{
          position: 'fixed', top: 56, right: 16, zIndex: 30,
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(255,255,255,0.9)', border: '1px solid #e5e7eb',
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontSize: 16,
        }}>
        ✏️
      </button>

      {/* 편집 모달 */}
      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', maxHeight: '85vh', overflowY: 'auto', padding: '0 0 40px' }}>
            {/* 핸들 */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: '#e5e7eb' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px 16px' }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#1f2937' }}>홈 화면 꾸미기</p>
              <button onClick={handleClose} style={{ background: 'none', border: 'none', fontSize: 14, color: '#9ca3af', cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
            </div>

            {/* 무료 유저 안내 */}
            {!isPremium && (
              <div style={{ margin: '0 20px 16px', padding: '12px 16px', background: '#fef9e7', borderRadius: 12, border: '1px solid #fde68a' }}>
                <p style={{ fontSize: 13, color: '#92400e', fontWeight: 600 }}>✨ 프리미엄 기능</p>
                <p style={{ fontSize: 12, color: '#b45309', marginTop: 4 }}>이미지를 미리볼 수 있어요. 적용하려면 프리미엄이 필요해요.</p>
              </div>
            )}

            <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* 커버 이미지 */}
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 }}>커버 이미지</p>
                <div style={{ height: 120, borderRadius: 12, overflow: 'hidden', background: coverPreview ? undefined : 'var(--color-primary-light)', position: 'relative', cursor: 'pointer' }}
                  onClick={() => coverRef.current?.click()}>
                  {coverPreview
                    ? <img src={coverPreview} alt="cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8 }}>
                        <span style={{ fontSize: 32 }}>🖼️</span>
                        <p style={{ fontSize: 12, color: 'var(--color-primary-mid)' }}>탭해서 이미지 선택</p>
                      </div>
                  }
                  {coverPreview && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <p style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>탭해서 변경</p>
                    </div>
                  )}
                </div>
                <input ref={coverRef} type="file" accept="image/png,image/jpeg,image/gif" style={{ display: 'none' }} onChange={handleCoverPick} />
                {coverPreview && (
                  <button onClick={() => { setCoverPreview(null); setCoverFile(null); setDirty(true) }}
                    style={{ marginTop: 8, fontSize: 12, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                    기본값으로 되돌리기
                  </button>
                )}
              </div>

              {/* 카테고리 카드 이미지 */}
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 }}>카테고리 카드 이미지</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {CAT_KEYS.map(cat => (
                    <div key={cat}>
                      <div style={{ height: 80, borderRadius: 10, overflow: 'hidden', background: catPreviews[cat] ? undefined : '#f9fafb', border: '1.5px dashed #e5e7eb', cursor: 'pointer', position: 'relative' }}
                        onClick={() => catRefs.current[cat]?.click()}>
                        {catPreviews[cat]
                          ? <img src={catPreviews[cat]!} alt={cat} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 4 }}>
                              <span style={{ fontSize: 24 }}>{CAT_EMOJI[cat]}</span>
                            </div>
                        }
                      </div>
                      <p style={{ fontSize: 11, color: '#6b7280', textAlign: 'center', marginTop: 4 }}>{cat}</p>
                      <input ref={el => { catRefs.current[cat] = el }} type="file" accept="image/png,image/jpeg,image/gif" style={{ display: 'none' }}
                        onChange={e => handleCatPick(cat, e)} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 저장 버튼 */}
            <div style={{ padding: '20px 20px 0' }}>
              <button onClick={handleSave} disabled={saving || !dirty}
                style={{ width: '100%', padding: '16px', borderRadius: 16, border: 'none', background: (saving || !dirty) ? '#e5e7eb' : 'var(--color-primary)', color: (saving || !dirty) ? '#9ca3af' : '#fff', fontSize: 15, fontWeight: 700, cursor: (saving || !dirty) ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                {saving ? '저장 중...' : isPremium ? '적용하기' : '✨ 프리미엄으로 적용하기'}
              </button>
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
