import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Loader2, MessageCircle, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/authStore'

const SUGGESTED = [
  'Cfare dokumentesh mungojne?',
  'Cili eshte risku kryesor?',
  'Ma permbledh kete procedure',
  'Cfare afatesh ka kjo procedure?',
  'Si ta plotesoj dosjen?',
]

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

function apiUrl(path: string) {
  const rawBase = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
  const base = rawBase.endsWith('/api') ? rawBase.slice(0, -4) : rawBase
  return `${base}/api${path}`
}

export function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId] = useState(() => {
    const stored = localStorage.getItem('jurist_chat_session_id')
    if (stored) return stored
    const id = crypto.randomUUID()
    localStorage.setItem('jurist_chat_session_id', id)
    return id
  })
  const bottomRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const { token } = useAuthStore()

  const procedureMatch = location.pathname.match(/\/procedures\/([a-zA-Z0-9-]+)/)
  const companyMatch = location.pathname.match(/\/companies\/([a-zA-Z0-9-]+)/)
  const procedureId = procedureMatch ? procedureMatch[1] : null
  const companyId = companyMatch ? companyMatch[1] : null

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const updateAssistantMessage = (id: string, content: string) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content } : m)))
  }

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return
    setInput('')

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
    }
    const assistantId = (Date.now() + 1).toString()
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: 'assistant', content: '' },
    ])
    setLoading(true)

    if (!token) {
      updateAssistantMessage(assistantId, 'Duhet te hyni ne llogari per te perdorur Jurist AI.')
      setLoading(false)
      return
    }

    try {
      const res = await fetch(apiUrl('/chat/message'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: text,
          procedure_id: procedureId,
          company_id: companyId,
          session_id: sessionId,
          stream: true,
        }),
      })

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() ?? ''

        for (const event of events) {
          const dataLine = event.split('\n').find((line) => line.startsWith('data: '))
          if (!dataLine) continue
          try {
            const data = JSON.parse(dataLine.slice(6))
            if (!data.done && data.delta) {
              full += data.delta
              updateAssistantMessage(assistantId, full)
            }
          } catch {
            // Ignore malformed events and keep the chat responsive.
          }
        }
      }

      if (buffer.trim()) {
        const dataLine = buffer.split('\n').find((line) => line.startsWith('data: '))
        if (dataLine) {
          try {
            const data = JSON.parse(dataLine.slice(6))
            if (!data.done && data.delta) {
              full += data.delta
              updateAssistantMessage(assistantId, full)
            }
          } catch {
            // Ignore a trailing partial event.
          }
        }
      }
    } catch {
      updateAssistantMessage(assistantId, 'Gabim ne lidhje. Provoni serish.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="w-[400px] h-[580px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-4 py-3 flex items-center justify-between">
            <div>
              <div className="text-white font-semibold flex items-center gap-2">Jurist AI</div>
              {procedureId && (
                <div className="text-indigo-200 text-xs mt-0.5">
                  Procedura #{procedureId.slice(0, 8)}
                </div>
              )}
              {companyId && !procedureId && (
                <div className="text-indigo-200 text-xs mt-0.5">
                  Kompania #{companyId.slice(0, 8)}
                </div>
              )}
              {!procedureId && !companyId && (
                <div className="text-indigo-200 text-xs mt-0.5">Modus i pergjithshem</div>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white hover:bg-indigo-500 rounded-lg p-1"
              type="button"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {messages.length === 0 && (
              <div>
                <p className="text-center text-gray-400 text-sm mb-4">Si mund te ndihmoj?</p>
                <div className="space-y-2">
                  {SUGGESTED.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="w-full text-left text-sm px-3 py-2 rounded-lg bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 transition-colors"
                      type="button"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-sm'
                      : 'bg-white text-gray-800 rounded-tl-sm border border-gray-200'
                  }`}
                >
                  {m.content || (
                    <span className="flex items-center gap-1 text-gray-400">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Duke shkruar...
                    </span>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="border-t bg-white p-3 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage(input)
                }
              }}
              placeholder="Shkruaj pyetjen..."
              className="flex-1 border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={loading}
            />
            <Button
              size="sm"
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 rounded-xl px-3"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(!open)}
        className="h-14 w-14 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg flex items-center justify-center transition-all hover:scale-105"
        title="Jurist AI Chat"
        type="button"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  )
}

export default ChatWidget
