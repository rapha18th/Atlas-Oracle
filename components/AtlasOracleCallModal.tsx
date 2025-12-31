// AtlasOracleCallModal.tsx
// Updated: agentId hard-coded to agent_3601kdtg1b0tewg8e1kh88fce7gv

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useConversation } from "@elevenlabs/react"

type CallState = "idle" | "connecting" | "connected" | "ending" | "ended"

type ConversationMessage = {
  timestamp: string
  source: "agent" | "user"
  message: string
}

// Ensure this type matches your app usage
export type VoiceVars = {
  location_coords: { lat: number; lng: number }
  area_summary: string
  // Updated to allow array of objects or strings, which the safeString function will handle via stringify
  top_opportunities: string | string[] | Array<{ name: string; concept: string; cost: string }>
  land_use_suggestions: string | string[]
  risks: string | string[]
  recommendations: string | string[]
}

interface AtlasOracleCallModalProps {
  isOpen: boolean
  onClose: () => void
  voiceVars: VoiceVars | null
  userName?: string
  safetyMode?: string
}

const AGENT_ID = "agent_3601kdtg1b0tewg8e1kh88fce7gv"

const AtlasOracleCallModal: React.FC<AtlasOracleCallModalProps> = ({
  isOpen,
  onClose,
  voiceVars,
  userName = "User",
  safetyMode = "public_demo"
}) => {
  const [callState, setCallState] = useState<CallState>("idle")
  const [conversationMessages, setConversationMessages] = useState<ConversationMessage[]>([])
  const [connErr, setConnErr] = useState<string | null>(null)
  const [termination, setTermination] = useState<string | null>(null)

  const callBeganRef = useRef<number | null>(null)
  const isProcessingEndRef = useRef(false)

  const dynamicVariables = useMemo(() => {
    if (!voiceVars) return null

    const safeString = (v: any) => {
      if (v == null) return ""
      if (typeof v === "string") return v
      try {
        return JSON.stringify(v)
      } catch {
        return String(v)
      }
    }

    return {
      // variables expected by the ElevenLabs prompt
      "location_coords.lat": String(voiceVars.location_coords?.lat ?? ""),
      "location_coords.lng": String(voiceVars.location_coords?.lng ?? ""),
      area_summary: safeString(voiceVars.area_summary),
      top_opportunities: safeString(voiceVars.top_opportunities),
      land_use_suggestions: safeString(voiceVars.land_use_suggestions),
      risks: safeString(voiceVars.risks),
      recommendations: safeString(voiceVars.recommendations),

      // optional extra variables
      user_name: userName,
      safety_mode: safetyMode
    }
  }, [voiceVars, userName, safetyMode])

  const { startSession, endSession, status, isSpeaking, error: sdkError } = useConversation({
    onConnect: () => {
      callBeganRef.current = Date.now()
      setCallState("connected")
      setConnErr(null)
      setTermination(null)
      setConversationMessages([])
    },
    onMessage: (message) => {
      setConversationMessages((prev) => [
        ...prev,
        {
          timestamp: new Date().toLocaleTimeString(),
          source: message.source as "agent" | "user",
          message: message.message
        }
      ])
    },
    onError: (error) => {
      setConnErr(error.message || "Conversation error")
      if (callBeganRef.current && !isProcessingEndRef.current) {
        setCallState("ending")
        try {
          endSession()
        } catch {}
        setCallState("idle")
      } else {
        setCallState("idle")
      }
    },
    onDisconnect: () => {
      if (!isProcessingEndRef.current && callBeganRef.current) {
        setTermination("Call ended.")
        setCallState("ended")
      }
    }
  })

  const requestMicrophonePermission = async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((t) => t.stop())
      return true
    } catch (err: any) {
      setConnErr(`Microphone access required: ${err?.message ?? "Permission denied"}`)
      return false
    }
  }

  const resetCallState = useCallback(() => {
    setCallState("idle")
    setConversationMessages([])
    setConnErr(null)
    setTermination(null)
    callBeganRef.current = null
    isProcessingEndRef.current = false
  }, [])

  const startCall = useCallback(async () => {
    if (callState !== "idle") return

    if (!dynamicVariables) {
      setConnErr("Run “Analyze Location” first so I can load the location context for the voice agent.")
      return
    }

    setCallState("connecting")
    setConnErr(null)
    setTermination(null)

    if (!(await requestMicrophonePermission())) {
      setCallState("idle")
      return
    }

    try {
      await startSession({
        agentId: AGENT_ID,
        dynamicVariables
      })
    } catch (err: any) {
      setConnErr(`Failed to start session: ${err?.message ?? "Unknown error"}`)
      setCallState("idle")
    }
  }, [callState, dynamicVariables, startSession])

  const endCall = useCallback(() => {
    if (callState === "ending" || callState === "ended") return
    isProcessingEndRef.current = true
    setCallState("ending")
    try {
      if (status === "connected") endSession()
    } catch {}
    setTermination("Call ended.")
    setCallState("ended")
  }, [callState, endSession, status])

  const forceClose = useCallback(() => {
    isProcessingEndRef.current = true
    try {
      if (status === "connected") endSession()
    } catch {}
    resetCallState()
    onClose()
  }, [endSession, onClose, resetCallState, status])

  useEffect(() => {
    if (!sdkError) return
    setConnErr(sdkError.message || "SDK error")
    setCallState("idle")
  }, [sdkError])

  useEffect(() => {
    if (!isOpen) resetCallState()
  }, [isOpen, resetCallState])

  if (!isOpen) return null

  const statusLine = (() => {
    if (callState === "connecting" || status === "connecting") return "Connecting…"
    if (callState === "ending") return "Ending…"
    if (connErr) return `Error: ${connErr}`
    if (termination) return termination
    if (callState === "connected" || status === "connected") {
      return isSpeaking ? "Connected — Assistant speaking…" : "Connected — Listening…"
    }
    return "Ready. Start when you’re set."
  })()

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16
      }}
    >
      <div
        style={{
          width: "min(820px, 100%)",
          height: "min(90vh, 820px)",
          background: "#0B1220",
          color: "#E5E7EB",
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.10)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        }}
      >
        <div style={{ padding: 16, borderBottom: "1px solid rgba(255,255,255,0.10)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Atlas Oracle — Voice Session</div>
              <div style={{ opacity: 0.8, fontSize: 13, marginTop: 6 }}>{statusLine}</div>
            </div>
            <button
              onClick={forceClose}
              disabled={callState === "ending"}
              style={{
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.18)",
                color: "#E5E7EB",
                borderRadius: 10,
                padding: "8px 10px",
                cursor: "pointer"
              }}
              title="Close"
            >
              Close
            </button>
          </div>

          {voiceVars?.location_coords ? (
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
              Loaded pin: {voiceVars.location_coords.lat}, {voiceVars.location_coords.lng}
            </div>
          ) : (
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
              Tip: Run “Analyze Location” first to load context for the agent.
            </div>
          )}
        </div>

        <div style={{ padding: 16, flex: 1, overflowY: "auto" }}>
          {conversationMessages.length === 0 ? (
            <div style={{ opacity: 0.8, fontSize: 14, textAlign: "center", padding: "40px 0" }}>
              {callState === "connected" ? (isSpeaking ? "Assistant is speaking…" : "Listening for your voice…") : "Start the call to begin."}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {conversationMessages.map((m, idx) => {
                const isUser = m.source === "user"
                return (
                  <div key={idx} style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
                    <div
                      style={{
                        maxWidth: "min(560px, 92%)",
                        padding: 12,
                        borderRadius: 14,
                        background: isUser ? "#2563EB" : "rgba(255,255,255,0.10)",
                        border: "1px solid rgba(255,255,255,0.12)"
                      }}
                    >
                      <div style={{ fontSize: 11, opacity: 0.75, marginBottom: 6 }}>
                        {isUser ? "You" : "Atlas Oracle"} • {m.timestamp}
                      </div>
                      <div style={{ fontSize: 14, lineHeight: 1.35 }}>{m.message}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ padding: 16, borderTop: "1px solid rgba(255,255,255,0.10)", display: "flex", gap: 10 }}>
          {callState === "idle" ? (
            <button
              onClick={startCall}
              disabled={callState === "connecting" || status === "connecting"}
              style={{
                flex: 1,
                background: "#22C55E",
                color: "#0B1220",
                fontWeight: 700,
                border: "none",
                borderRadius: 12,
                padding: "12px 14px",
                cursor: "pointer"
              }}
            >
              Start Call
            </button>
          ) : (
            <button
              onClick={endCall}
              disabled={callState === "ending"}
              style={{
                flex: 1,
                background: "#EF4444",
                color: "#fff",
                fontWeight: 700,
                border: "none",
                borderRadius: 12,
                padding: "12px 14px",
                cursor: "pointer"
              }}
            >
              End Call
            </button>
          )}

          <button
            onClick={forceClose}
            disabled={callState === "ending"}
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.18)",
              color: "#E5E7EB",
              borderRadius: 12,
              padding: "12px 14px",
              cursor: "pointer"
            }}
          >
            Force Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default AtlasOracleCallModal