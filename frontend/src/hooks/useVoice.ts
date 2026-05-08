'use client'

import { useState, useRef, useCallback } from 'react'
import { voice } from '@/lib/api'

interface UseVoiceOptions {
  onTranscript: (text: string) => void
  maxDurationMs?: number
}

interface UseVoiceReturn {
  isRecording:    boolean
  isTranscribing: boolean
  error:          string | null
  startRecording: () => Promise<void>
  stopRecording:  () => void
  clearError:     () => void
}

export function useVoice({
  onTranscript,
  maxDurationMs = 60_000,
}: UseVoiceOptions): UseVoiceReturn {
  const [isRecording,    setIsRecording]    = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [error,          setError]          = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef        = useRef<Blob[]>([])
  const timeoutRef       = useRef<ReturnType<typeof setTimeout> | null>(null)
  const streamRef        = useRef<MediaStream | null>(null)

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const stopRecording = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      mediaRecorderRef.current.stop()
    }
  }, [])

  const startRecording = useCallback(async () => {
    setError(null)
    chunksRef.current = []

    // Check browser support
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Voice recording is not supported in this browser.')
      return
    }
    if (typeof MediaRecorder === 'undefined') {
      setError('MediaRecorder is not supported in this browser.')
      return
    }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
    } catch (err) {
      if ((err as { name?: string }).name === 'NotAllowedError') {
        setError('Microphone permission denied.')
      } else {
        setError('Could not access microphone.')
      }
      return
    }

    // Determine supported MIME type
    const mimeType = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ].find((m) => MediaRecorder.isTypeSupported(m)) ?? ''

    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    mediaRecorderRef.current = recorder

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = async () => {
      stopStream()
      setIsRecording(false)

      const blob = new Blob(chunksRef.current, {
        type: mimeType || 'audio/webm',
      })
      chunksRef.current = []

      if (blob.size < 1000) {
        // Too short — likely no audio captured
        return
      }

      setIsTranscribing(true)
      try {
        const result = await voice.transcribe(blob)
        if (result.text?.trim()) {
          onTranscript(result.text.trim())
        }
      } catch {
        setError('Transcription failed. Please try again.')
      } finally {
        setIsTranscribing(false)
      }
    }

    recorder.onerror = () => {
      setError('Recording error. Please try again.')
      setIsRecording(false)
      stopStream()
    }

    recorder.start(250) // Collect data every 250ms
    setIsRecording(true)

    // Auto-stop after maxDurationMs
    timeoutRef.current = setTimeout(() => {
      stopRecording()
    }, maxDurationMs)
  }, [onTranscript, maxDurationMs, stopRecording, stopStream])

  const clearError = useCallback(() => setError(null), [])

  return {
    isRecording,
    isTranscribing,
    error,
    startRecording,
    stopRecording,
    clearError,
  }
}
