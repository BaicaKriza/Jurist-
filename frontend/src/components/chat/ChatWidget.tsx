import React, { useState, useRef, useEffect, useCallback } from 'react'
import { MessageCircle, X, Send, Minimize2, Bot, User, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  loading?: boolean
}

interface ChatWidgetProps {
  companyId?: string
  procedureId?: string
}

const WELCOME: Message = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Mirë se vini! Jam **Jurist AI**, asistenti juaj për prokurimin publik shqiptar.\n\n' +
    'Mund t\'ju ndihmoj me:\n' +
    '• Dokumentet e kërkuara për procedura\n' +
    '• Kërkesat ligjore dhe afatet\n' +
    '• Analizën e dosjes suaj\n' +
    '• Çdo pyetje për prokurimin publik\n\n' +
    'Si mund t\'ju ndihmoj?',
}

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 rounded text-sm">$1</code>')
    .replace(/^• /gm, '&bull; ')
    .replace(/\\n/g, '\n')
    .replace(/\n/g, '<br/>')
}

export function ChatWidget({ companyId, procedureId }: ChatWidgetProps) {
  const { token } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [messages, setMessages] = useState<Message[]>([WELCOME])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Auto-scroll on new content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || streaming) return

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text }
    const assistantId = (Date.now() + 1).toString()
    const assistantMsg: Message = { id: assistantId, role: 'assistant', content: '', loading: true }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setInput('')
    setStreaming(true)

    // Build history for API (exclude welcome + current empty assistant)
    const history = [...messages, userMsg]
      .filter((m) => m.id !== 'welcome' && !m.loading)
      .map((m) => ({ role: m.role, content: m.content }))

    abortRef.current = new AbortController()

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: history,
          company_id: companyId ?? null,
          procedure_id: procedureId ?? null,
        }),
        signal: abortRef.current.signal,
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      if (!response.body) throw new Error('No response body')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const raw = decoder.decode(value, { stream: true })
        const lines = raw.split('\n')

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') break
          if (data.startsWith('[GABIM:')) {
            accumulated += `\n${data}`
          } else {
            accumulated += data.replace(/\\n/g, '\n')
          }
          // Update message in real time
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: accumulated, loading: false } : m
            )
          )
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: 'Gabim në komunikim me serverin. Provoni sërish.', loading: false }
              : m
          )
        )
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }, [input, messages, streaming, token, companyId, procedureId])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearChat = () => {
    if (streaming) abortRef.current?.abort()
    setMessages([WELCOME])
    setStreaming(false)
  }

  if (!token) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {/* Chat panel */}
      {open && !minimized && (
        <div className="w-96 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
          style={{ height: '520px' }}>

          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">Jurist AI</p>
                <p className="text-blue-200 text-xs">Asistent prokurimi</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={clearChat}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                title="Pastro bisedën"
              >
                <Trash2 className="w-3.5 h-3.5 text-white" />
              </button>
              <button
                onClick={() => setMinimized(true)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              >
                <Minimize2 className="w-3.5 h-3.5 text-white" />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          </div>

          {/* Context badge */}
          {(companyId || procedureId) && (
            <div className="px-3 py-1.5 bg-blue-50 border-b border-blue-100 flex gap-2 flex-wrap">
              {companyId && (
                <span className="text-xs text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                  📁 Kontekst kompanie aktiv
                </span>
              )}
              {procedureId && (
                <span className="text-xs text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                  📋 Kontekst procedure aktiv
                </span>
              )}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs mt-0.5
                  ${msg.role === 'user' ? 'bg-blue-500' : 'bg-gray-700'}`}>
                  {msg.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                </div>

                {/* Bubble */}
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed
                  ${msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-sm'
                    : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                  }`}>
                  {msg.loading ? (
                    <span className="flex items-center gap-1.5 text-gray-500">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span className="text-xs">Duke shkruar...</span>
                    </span>
                  ) : msg.role === 'assistant' ? (
                    <span
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                    />
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Suggested prompts (shown when only welcome message) */}
          {messages.length === 1 && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5">
              {[
                'Çfarë dokumente nevojiten?',
                'Si të aplikoj për prokurimin?',
                'Çfarë është DST-ja?',
                'Kontrollo dosjen time',
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); textareaRef.current?.focus() }}
                  className="text-xs bg-gray-100 hover:bg-blue-50 hover:text-blue-700 text-gray-600 px-2.5 py-1 rounded-full border border-gray-200 hover:border-blue-200 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="border-t border-gray-200 p-3 flex gap-2 items-end">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Shkruani pyetjen tuaj... (Enter = dërgo)"
              className="flex-1 resize-none min-h-[40px] max-h-24 text-sm rounded-xl border-gray-200 focus:border-blue-300"
              rows={1}
              disabled={streaming}
            />
            <Button
              size="sm"
              onClick={sendMessage}
              disabled={!input.trim() || streaming}
              className="rounded-xl h-10 w-10 p-0 flex-shrink-0 bg-blue-600 hover:bg-blue-700"
            >
              {streaming
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />
              }
            </Button>
          </div>
        </div>
      )}

      {/* Minimized bar */}
      {open && minimized && (
        <div
          className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-3 cursor-pointer hover:shadow-xl transition-shadow"
          onClick={() => setMinimized(false)}
        >
          <Bot className="w-4 h-4" />
          <span className="text-sm font-medium">Jurist AI</span>
          {streaming && <Loader2 className="w-3 h-3 animate-spin opacity-70" />}
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false) }}
            className="ml-1 hover:bg-white/20 rounded p-0.5"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Toggle button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="w-14 h-14 bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center group"
          title="Hap Jurist AI"
        >
          <MessageCircle className="w-6 h-6 group-hover:scale-110 transition-transform" />
        </button>
      )}
    </div>
  )
}
