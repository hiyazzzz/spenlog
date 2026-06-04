'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Category {
  id: string
  name: string
  is_default: boolean
  is_hidden: boolean
}

interface Props {
  userId: string
  customCategories: Category[]
  onUpdate: () => void
}

const DEFAULT_CATEGORIES = ['생활비', '활동비', '고정비', '친목비', '예비비']

export default function CategoryManager({ userId, customCategories, onUpdate }: Props) {
  const supabase = createClient()
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)

  async function addCategory() {
    if (!newName.trim()) return
    setSaving(true)
    await supabase.from('categories').insert({
      user_id: userId,
      name: newName.trim(),
      is_default: false,
      is_hidden: false,
    })
    setNewName('')
    setAdding(false)
    setSaving(false)
    onUpdate()
  }

  async function hideCategory(id: string) {
    await supabase.from('categories').update({ is_hidden: true }).eq('id', id)
    onUpdate()
  }

  async function restoreCategory(id: string) {
    await supabase.from('categories').update({ is_hidden: false }).eq('id', id)
    onUpdate()
  }

  const visible = customCategories.filter(c => !c.is_hidden)
  const hidden = customCategories.filter(c => c.is_hidden)

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
      <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8, fontWeight: 600 }}>카테고리 관리</p>

      {/* 기본 카테고리 */}
      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6, marginBottom: 8 }}>
        {DEFAULT_CATEGORIES.map(cat => (
          <span key={cat} style={{
            fontSize: 11, padding: '4px 10px', borderRadius: 20,
            background: 'var(--color-primary-light)', color: 'var(--color-primary)',
            fontWeight: 600,
          }}>{cat}</span>
        ))}
      </div>

      {/* 커스텀 카테고리 */}
      {visible.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6, marginBottom: 8 }}>
          {visible.map(cat => (
            <span key={cat.id} style={{
              fontSize: 11, padding: '4px 10px', borderRadius: 20,
              background: '#f3f4f6', color: '#374151',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              {cat.name}
              <button onClick={() => hideCategory(cat.id)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#9ca3af', fontSize: 11, padding: 0, lineHeight: 1,
              }}>×</button>
            </span>
          ))}
        </div>
      )}

      {/* 추가 폼 */}
      {adding ? (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="text"
            placeholder="카테고리명"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCategory()}
            style={{
              flex: 1, padding: '6px 10px', borderRadius: 8,
              border: '1.5px solid var(--color-primary-light)',
              fontSize: 12, outline: 'none', fontFamily: 'inherit',
            }}
            autoFocus
            maxLength={10}
          />
          <button onClick={addCategory} disabled={saving || !newName.trim()} style={{
            padding: '6px 12px', borderRadius: 8, border: 'none',
            background: 'var(--color-primary)', color: '#fff',
            fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
          }}>추가</button>
          <button onClick={() => { setAdding(false); setNewName('') }} style={{
            padding: '6px 10px', borderRadius: 8, border: '1.5px solid #e5e7eb',
            background: '#fff', color: '#6b7280', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
          }}>취소</button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} style={{
          fontSize: 11, color: 'var(--color-primary)', background: 'none',
          border: '1.5px dashed var(--color-primary-light)', padding: '6px 14px',
          borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit',
        }}>+ 카테고리 추가</button>
      )}

      {/* 숨긴 카테고리 복원 */}
      {hidden.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <p style={{ fontSize: 10, color: '#9ca3af', marginBottom: 4 }}>숨긴 카테고리</p>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
            {hidden.map(cat => (
              <button key={cat.id} onClick={() => restoreCategory(cat.id)} style={{
                fontSize: 10, padding: '3px 8px', borderRadius: 20,
                background: '#f3f4f6', color: '#9ca3af', border: 'none',
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                {cat.name} 복원
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
