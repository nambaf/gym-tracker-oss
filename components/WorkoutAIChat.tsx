'use client'

import { useState, useRef, useEffect } from 'react'
import {
    chatWithCoach,
    suggestExerciseAlternatives,
    type ChatMessage,
} from '@/lib/workout/aiActions'
import type { MuscleGroupSummary } from '@/lib/planAnalysis'
import type { Exercise, PlanRow, Session, SetEntry } from '@/lib/models'
import type { TrainingMode } from '@/lib/hypertrophyThresholds'
import { useT, useLang } from '@/lib/i18n/I18nProvider'
import { useAIEnabled } from '@/lib/appConfig'

type ChatMode = 'weekly' | 'plan'

interface WorkoutAIChatProps {
    mode: ChatMode
    planSummary: MuscleGroupSummary[]
    exercises: Exercise[]
    plan: PlanRow[]
    weekSessions?: Session[]
    weekSets?: SetEntry[]
    missingExercises?: Array<{
        exerciseName: string
        plannedSets: number
        completedSets: number
        remainingSets: number
    }>
    trainingMode?: TrainingMode
}

export function WorkoutAIChat({
    mode,
    planSummary,
    exercises,
    plan,
    weekSessions = [],
    weekSets = [],
    missingExercises = [],
    trainingMode = 'mixed'
}: WorkoutAIChatProps) {
    const t = useT()
    const lang = useLang()
    const aiEnabled = useAIEnabled()
    const [isOpen, setIsOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [input, setInput] = useState('')
    const [error, setError] = useState<string | null>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    // Auto-scroll to the latest message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // Focus the input on open + pre-fill a contextual question.
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 0)

            if (messages.length === 0 && !input) {
                const today = new Date().toLocaleDateString(lang === 'en' ? 'en-US' : 'it-IT', { weekday: 'long' })

                if (mode === 'weekly') {
                    const sessionCount = weekSessions.length
                    const lastSession = weekSessions[weekSessions.length - 1]

                    if (lang === 'en') {
                        const lastNote = lastSession?.note ? ` (last note: "${lastSession.note}")` : ''
                        setInput(`Hi Coach! Today is ${today}. I did ${sessionCount} sessions this week${lastNote}. How am I doing?`)
                    } else {
                        const lastNote = lastSession?.note ? ` (Nota ultima: "${lastSession.note}")` : ''
                        setInput(`Ciao Coach! Oggi è ${today}. Ho fatto ${sessionCount} sessioni questa settimana${lastNote}. Come sto andando?`)
                    }
                } else {
                    if (lang === 'en') {
                        setInput(`Hi Coach! Today is ${today}. Review my current plan: I need advice on balance and volume.`)
                    } else {
                        setInput(`Ciao Coach! Oggi è ${today}. Analizza il mio piano attuale: ho bisogno di consigli su equilibrio e volume.`)
                    }
                }
            }
        }
    }, [isOpen, lang]) // eslint-disable-line react-hooks/exhaustive-deps

    const handleOpen = () => {
        setIsOpen(true)
    }

    const handleSend = async () => {
        if (!input.trim() || isLoading) return

        const userMessage: ChatMessage = { role: 'user', content: input.trim() }
        setMessages(prev => [...prev, userMessage])
        setInput('')
        setIsLoading(true)
        setError(null)

        try {
            const altRegex = lang === 'en'
                ? /alternative[s]?\s+(?:to|for)?\s*(.+)/i
                : /alternativ[aei]\s+(?:a|per|di|al)?\s*(.+)/i
            const alternativeMatch = input.match(altRegex)

            let response: string

            if (alternativeMatch) {
                const exerciseName = alternativeMatch[1].trim()
                response = await suggestExerciseAlternatives(exerciseName, exercises, undefined, lang)
            } else {
                response = await chatWithCoach(
                    [...messages, userMessage],
                    { planSummary, exercises, plan, weekSessions, weekSets, trainingMode, lang }
                )
            }

            setMessages(prev => [...prev, { role: 'assistant', content: response }])
        } catch (err) {
            console.error('Chat error:', err)
            setError(t.ai.errorRetry)
        } finally {
            setIsLoading(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    const quickActions = lang === 'en'
        ? (mode === 'weekly'
            ? [
                'What am I missing this week?',
                'Alternatives for leg curl',
                'How do I make up back volume?',
            ]
            : [
                'How can I balance the plan?',
                'Adding a 4th day, what should I put in?',
                'Alternatives for hack squat',
            ])
        : (mode === 'weekly'
            ? [
                'Cosa mi manca questa settimana?',
                'Alternative per leg curl',
                'Come recupero il volume dorsali?',
            ]
            : [
                'Come bilanciare meglio il piano?',
                'Aggiungo un 4 giorno, cosa metto?',
                'Alternative per hack squat',
            ])

    if (!aiEnabled) return null

    return (
        <div className="card">
            {/* Header — always visible */}
            <button
                onClick={() => isOpen ? setIsOpen(false) : handleOpen()}
                className="w-full p-4 flex items-center justify-between hover:bg-paper-sunken/60 transition-colors rounded-2xl"
            >
                <div className="flex items-center gap-3 text-left">
                    <span className="w-9 h-9 rounded-xl bg-ink text-white inline-flex items-center justify-center text-base font-semibold">AI</span>
                    <div>
                        <h3 className="font-semibold">
                            {mode === 'weekly' ? t.ai.weeklyTitle : t.ai.planTitle}
                        </h3>
                        <p className="text-sm text-muted">
                            {mode === 'weekly' ? t.ai.weeklySubtitle : t.ai.planSubtitle}
                        </p>
                    </div>
                </div>
                <span className={`text-muted-2 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
            </button>

            {/* Chat panel */}
            {isOpen && (
                <div className="border-t border-ink/[0.06]">
                    {/* Messages */}
                    <div className="max-h-80 overflow-y-auto p-4 space-y-4">
                        {messages.length === 0 && !isLoading && (
                            <div className="p-3 bg-paper-sunken rounded-xl text-sm text-ink-soft">
                                <p>{t.ai.greeting}</p>
                            </div>
                        )}

                        {error && (
                            <div className="p-3 bg-paper-sunken text-danger rounded-xl text-sm border-l-4 border-danger">
                                {error}
                            </div>
                        )}

                        {messages.map((msg, i) => (
                            <div
                                key={i}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.role === 'user'
                                        ? 'bg-ink text-white'
                                        : 'bg-paper-sunken text-ink'
                                        }`}
                                >
                                    <p className="whitespace-pre-wrap">{msg.content}</p>
                                </div>
                            </div>
                        ))}

                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-paper-sunken p-3 rounded-2xl">
                                    <div className="flex gap-1">
                                        <span className="w-2 h-2 bg-muted-2 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <span className="w-2 h-2 bg-muted-2 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <span className="w-2 h-2 bg-muted-2 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Quick actions */}
                    {messages.length <= 1 && !isLoading && (
                        <div className="px-4 pb-2 flex flex-wrap gap-2">
                            {quickActions.map((action, i) => (
                                <button
                                    key={i}
                                    onClick={() => {
                                        setInput(action)
                                        inputRef.current?.focus()
                                    }}
                                    className="text-xs px-3 py-1.5 bg-paper-sunken hover:bg-paper-card border border-ink/[0.06] rounded-full transition-colors text-ink-soft"
                                >
                                    {action}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Input */}
                    <div className="p-4 border-t border-ink/[0.06]">
                        <div className="flex gap-2">
                            <input
                                ref={inputRef}
                                type="text"
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={t.ai.placeholder}
                                className="input flex-1"
                                disabled={isLoading}
                            />
                            <button
                                onClick={handleSend}
                                disabled={isLoading || !input.trim()}
                                className="btn-primary px-4 disabled:opacity-40"
                            >
                                {isLoading ? '...' : '→'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
