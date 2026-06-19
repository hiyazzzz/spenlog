'use client'
import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'


interface Category {
  id: string; name: string; is_default: boolean; is_hidden: boolean; sort_order: number
}

interface Props {
  userId: string
  initialCategories: Category[]
  spentMap: Record<string, number>
}

const DEFAULT_NAMES = ['생활비', '활동비', '고정비', '친목비', '예비비', '수입']

export default function CategoryPage({ userId, initialCategories, spentMap }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [cats, setCats] = useState<Category[]>(initialCategories)

  // 서버 seed 실패 시 클라이언트 사이드 fallback seed
  // RLS 거부여도 화면에는 기본 카테고리 표시
  useEffect(() => {
    if (cats.length > 0) return
    const seedData = DEFAULT_NAMES.map((name, i) => ({
      user_id: userId, name, is_default: true, is_hidden: false, sort_order: i,
    }))
    supabase.from('categories').insert(seedData).select().then(({ data, error }) => {
      if (error) {
        console.error('[category client seed error]', error.code, error.message)
        // RLS 에러여도 화면에는 기본 카테고리 보여주기
        setCats(DEFAULT_NAMES.map((name, i) => ({
          id: `fallback-${i}`,
          name,
          is_default: true,
          is_hidden: false,
          sort_order: i,
        })))
        return
      }
      if (data && data.length > 0) setCats(data)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const dragOver = useRef<number | null>(null)

  async function addCategory() {
    if (!newName.trim()) return
    const maxOrder = Math.max(...cats.map(c => c.sort_order), 0)
    const { data } = await supabase.from('categories').insert({
      user_id: userId, name: newName.trim(),
      is_default: false, is_hidden: false, sort_order: maxOrder + 1,
    }).select().single()
    if (data) setCats(prev => [...prev, data])
    setNewName(''); setAdding(false)
    router.refresh()
  }

  async function deleteCategory(id: string) {
    await supabase.from('categories').delete().eq('id', id)
    setCats(prev => prev.filter(c => c.id !== id))
    router.refresh()
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) return
    await supabase.from('categories').update({ name: editName.trim() }).eq('id', id)
    setCats(prev => prev.map(c => c.id === id ? { ...c, name: editName.trim() } : c))
    setEditingId(null); setEditName('')
    router.refresh()
  }

  function handleDragStart(idx: number) { setDragIdx(idx) }
  function handleDragEnter(idx: number) { dragOver.current = idx }
  async function handleDragEnd() {
    if (dragIdx === null || dragOver.current === null || dragIdx === dragOver.current) {
      setDragIdx(null); return
    }
    const newCats = [...cats]
    const [moved] = newCats.splice(dragIdx, 1)
    newCats.splice(dragOver.current, 0, moved)
    const updated = newCats.map((c, i) => ({ ...c, sort_order: i }))
    setCats(updated)
    setDragIdx(null); dragOver.current = null
    await Promise.all(updated.map(c =>
      supabase.from('categories').update({ sort_order: c.sort_order }).eq('id', c.id)
    ))
    router.refresh()
  }

  const visible = cats.filter(c => !c.is_hidden)

  return (
    <div className="min-h-screen pb-24" style={{ background: 'var(--color-bg)' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={() => router.back()} style={{
          background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, padding: 0,
          color: 'var(--color-accent)', fontFamily: 'inherit',
        }}>←</button>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-accent)' }}>카테고리 관리</h1>
      </div>

      <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>
        드래그로 순서를 바꾸고, 탭해서 이름을 수정할 수 있어요.<br />
        기본 카테고리도 수정·삭제 가능해요.
      </p>

      {/* 카테고리 목록 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visible.map((cat, idx) => {
          const spent = spentMap[cat.name] ?? 0
          const isEditing = editingId === cat.id
          const isDragging = dragIdx === idx

          return (
            <div
              key={cat.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragEnter={() => handleDragEnter(idx)}
              onDragEnd={handleDragEnd}
              onDragOver={e => e.preventDefault()}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: '#fff', borderRadius: 14, padding: '12px 14px',
                border: '1px solid #f0f0f0',
                opacity: isDragging ? 0.5 : 1,
                boxShadow: isDragging ? '0 4px 16px rgba(0,0,0,0.12)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {/* 드래그 핸들 */}
              <span style={{ color: '#d1d5db', cursor: 'grab', fontSize: 18, userSelect: 'none' }}>⠿</span>

              {/* 이름 영역 */}
              <div style={{ flex: 1 }}>
                {isEditing ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(cat.id) }}
                      autoFocus maxLength={10}
                      style={{
                        flex: 1, padding: '6px 10px', borderRadius: 8,
                        border: '1.5px solid var(--color-primary)', fontSize: 13,
                        outline: 'none', fontFamily: 'inherit',
                      }}
                    />
                    <button onClick={() => saveEdit(cat.id)} style={{
                      padding: '6px 12px', borderRadius: 8, border: 'none',
                      background: 'var(--color-primary)', color: '#fff',
                      fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                    }}>저장</button>
                    <button onClick={() => { setEditingId(null); setEditName('') }} style={{
                      padding: '6px 10px', borderRadius: 8, border: '1.5px solid #e5e7eb',
                      background: '#fff', color: '#6b7280', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                    }}>취소</button>
                  </div>
                ) : (
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#1f2937' }}>{cat.name}</p>
                    {spent > 0 && (
                      <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
                        이번달 {spent.toLocaleString()}원
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* 액션 버튼 */}
              {!isEditing && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => { setEditingId(cat.id); setEditName(cat.name) }} style={{
                    fontSize: 11, color: 'var(--color-primary)', background: 'var(--color-primary-light)',
                    border: 'none', padding: '5px 10px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                  }}>수정</button>
                  <button onClick={() => deleteCategory(cat.id)} style={{
                    fontSize: 11, color: '#ef4444', background: '#fef2f2',
                    border: 'none', padding: '5px 10px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                  }}>삭제</button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 추가 버튼 */}
      {adding ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input
            type="text" placeholder="새 카테고리 이름" value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCategory()}
            autoFocus maxLength={10}
            style={{
              flex: 1, padding: '12px 14px', borderRadius: 12,
              border: '1.5px solid var(--color-primary)', fontSize: 14,
              outline: 'none', fontFamily: 'inherit', background: '#fff',
            }}
          />
          <button onClick={addCategory} style={{
            padding: '12px 16px', borderRadius: 12, border: 'none',
            background: 'var(--color-primary)', color: '#fff',
            fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}>추가</button>
          <button onClick={() => { setAdding(false); setNewName('') }} style={{
            padding: '12px 14px', borderRadius: 12, border: '1.5px solid #e5e7eb',
            background: '#fff', color: '#6b7280', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
          }}>취소</button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} style={{
          width: '100%', marginTop: 12, padding: '14px',
          borderRadius: 14, border: '2px dashed var(--color-primary-light)',
          background: 'transparent', color: 'var(--color-primary)',
          fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        }}>+ 카테고리 추가</button>
      )}
    </div>
  )
}
